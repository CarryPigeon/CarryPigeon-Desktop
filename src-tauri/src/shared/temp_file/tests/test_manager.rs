use tempfile::TempDir;
use tokio::io::AsyncWriteExt;

use crate::shared::temp_file::TempFileManager;

async fn create_test_manager() -> (TempFileManager, TempDir) {
    let dir = TempDir::new().unwrap();
    let app_data = dir.path().join("app_data");
    let meta_db = dir.path().join("metadata.db");
    let manager = TempFileManager::new(app_data, meta_db).await.unwrap();
    (manager, dir)
}

#[tokio::test]
async fn test_create_download_and_mark_complete() {
    let (manager, _dir) = create_test_manager().await;

    let (mut file, _existing) = manager
        .create_download(
            "test-1",
            "https://example.com/file.bin",
            Some("application/octet-stream"),
            100,
        )
        .await
        .unwrap();

    file.write_all(b"hello world").await.unwrap();
    drop(file);

    manager.update_progress("test-1", 11).await.unwrap();
    let final_path = manager.mark_complete("test-1", "bin").await.unwrap();

    assert!(
        !manager
            .base_dir()
            .join("downloads")
            .join("test-1.part")
            .exists()
    );
    assert!(std::path::Path::new(&final_path).exists());

    let meta = manager.get_metadata("test-1").await.unwrap();
    assert_eq!(meta.state, "complete");
    assert_eq!(meta.total_size, 100);
    assert_eq!(meta.downloaded, 11);
    assert_eq!(meta.namespace, "downloads");
}

#[tokio::test]
async fn test_mark_failed() {
    let (manager, _dir) = create_test_manager().await;

    let (mut file, _existing) = manager
        .create_download("test-fail", "https://example.com/fail.bin", None, 0)
        .await
        .unwrap();
    file.write_all(b"partial data").await.unwrap();
    drop(file);

    manager.mark_failed("test-fail").await.unwrap();

    let meta = manager.get_metadata("test-fail").await.unwrap();
    assert_eq!(meta.state, "failed");
}

#[tokio::test]
async fn test_remove_temp_file() {
    let (manager, _dir) = create_test_manager().await;

    let (mut file, _existing) = manager
        .create_download("test-rm", "https://example.com/rm.bin", None, 0)
        .await
        .unwrap();
    file.write_all(b"data").await.unwrap();
    drop(file);
    manager.mark_complete("test-rm", "bin").await.unwrap();

    manager.remove("test-rm").await.unwrap();

    assert!(manager.get_metadata("test-rm").await.is_err());
}

#[tokio::test]
async fn test_save_to() {
    let (manager, _dir) = create_test_manager().await;

    let (mut file, _existing) = manager
        .create_download("test-save", "https://example.com/save.bin", None, 0)
        .await
        .unwrap();
    file.write_all(b"save me").await.unwrap();
    drop(file);
    manager.mark_complete("test-save", "txt").await.unwrap();

    let dest = manager.base_dir().join("saved-copy.txt");
    let _result = manager
        .save_to("test-save", &dest.to_string_lossy())
        .await
        .unwrap();

    assert!(dest.exists());
    assert_eq!(std::fs::read_to_string(&dest).unwrap(), "save me");
}

#[tokio::test]
async fn test_save_to_fails_if_not_complete() {
    let (manager, _dir) = create_test_manager().await;

    let (_file, _existing) = manager
        .create_download("test-nc", "https://example.com/nc.bin", None, 0)
        .await
        .unwrap();

    let dest = manager.base_dir().join("should-not-exist.txt");
    let result = manager.save_to("test-nc", &dest.to_string_lossy()).await;
    assert!(result.is_err());
}

#[tokio::test]
async fn test_create_download_appends_to_existing_part() {
    let (manager, _dir) = create_test_manager().await;

    // 第一次：写入 5 字节
    let (mut file, existing1) = manager
        .create_download(
            "resume-1",
            "https://example.com/big.bin",
            Some("application/octet-stream"),
            100,
        )
        .await
        .unwrap();
    assert_eq!(existing1, 0);
    file.write_all(b"hello").await.unwrap();
    drop(file);

    // 第二次：应保留已有字节
    let (mut file, existing2) = manager
        .create_download(
            "resume-1",
            "https://example.com/big.bin",
            Some("application/octet-stream"),
            100,
        )
        .await
        .unwrap();
    assert_eq!(existing2, 5);
    file.write_all(b" world").await.unwrap();
    drop(file);

    let part = manager.base_dir().join("downloads").join("resume-1.part");
    let bytes = std::fs::read(&part).unwrap();
    assert_eq!(bytes, b"hello world");
}

#[tokio::test]
async fn test_lookup_incomplete_by_url_returns_in_progress_only() {
    let (manager, _dir) = create_test_manager().await;
    // 没有记录
    let r = manager
        .lookup_incomplete_by_url("https://example.com/none")
        .await
        .unwrap();
    assert!(r.is_none());

    // 创建并失败
    let (mut file, _) = manager
        .create_download("dl-fail", "https://example.com/x.bin", None, 0)
        .await
        .unwrap();
    file.write_all(b"abc").await.unwrap();
    drop(file);
    manager.update_progress("dl-fail", 3).await.unwrap();
    manager.mark_failed("dl-fail").await.unwrap();

    // 失败任务也应被检索到
    let r = manager
        .lookup_incomplete_by_url("https://example.com/x.bin")
        .await
        .unwrap();
    assert!(r.is_some());
    let (id, downloaded) = r.unwrap();
    assert_eq!(id, "dl-fail");
    assert_eq!(downloaded, 3);
}

#[tokio::test]
async fn test_prune_incomplete_downloads_removes_part_files() {
    let (manager, _dir) = create_test_manager().await;
    // 创建两个未完成任务
    let (mut f1, _) = manager
        .create_download("prune-1", "https://example.com/a.bin", None, 0)
        .await
        .unwrap();
    f1.write_all(b"data1").await.unwrap();
    drop(f1);
    let (mut f2, _) = manager
        .create_download("prune-2", "https://example.com/b.bin", None, 0)
        .await
        .unwrap();
    f2.write_all(b"data2").await.unwrap();
    drop(f2);
    manager.mark_failed("prune-2").await.unwrap();

    let part1 = manager.base_dir().join("downloads").join("prune-1.part");
    let part2 = manager.base_dir().join("downloads").join("prune-2.part");
    assert!(part1.exists());
    assert!(part2.exists());

    let count = manager.prune_incomplete_downloads().await.unwrap();
    assert_eq!(count, 2);
    assert!(!part1.exists());
    assert!(!part2.exists());
    assert!(manager.get_metadata("prune-1").await.is_err());
    assert!(manager.get_metadata("prune-2").await.is_err());
}
