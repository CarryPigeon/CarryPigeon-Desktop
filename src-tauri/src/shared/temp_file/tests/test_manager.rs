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

    let mut file = manager
        .create_download("test-1", "https://example.com/file.bin", Some("application/octet-stream"), 100)
        .await
        .unwrap();

    file.write_all(b"hello world").await.unwrap();
    drop(file);

    manager.update_progress("test-1", 11).await.unwrap();
    let final_path = manager.mark_complete("test-1", "bin").await.unwrap();

    assert!(!manager.base_dir().join("downloads").join("test-1.part").exists());
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

    let mut file = manager
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

    let mut file = manager
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

    let mut file = manager
        .create_download("test-save", "https://example.com/save.bin", None, 0)
        .await
        .unwrap();
    file.write_all(b"save me").await.unwrap();
    drop(file);
    manager.mark_complete("test-save", "txt").await.unwrap();

    let dest = manager.base_dir().join("saved-copy.txt");
    let _result = manager.save_to("test-save", &dest.to_string_lossy()).await.unwrap();

    assert!(dest.exists());
    assert_eq!(
        std::fs::read_to_string(&dest).unwrap(),
        "save me"
    );
}

#[tokio::test]
async fn test_save_to_fails_if_not_complete() {
    let (manager, _dir) = create_test_manager().await;

    let _file = manager
        .create_download("test-nc", "https://example.com/nc.bin", None, 0)
        .await
        .unwrap();

    let dest = manager.base_dir().join("should-not-exist.txt");
    let result = manager.save_to("test-nc", &dest.to_string_lossy()).await;
    assert!(result.is_err());
}
