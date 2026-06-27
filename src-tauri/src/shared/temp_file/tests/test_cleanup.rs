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
async fn test_cleanup_expired_downloading() {
    let (manager, _dir) = create_test_manager().await;

    let (mut file, _existing) = manager
        .create_download("old-dl", "https://example.com/old.bin", None, 100)
        .await
        .unwrap();
    file.write_all(b"old data").await.unwrap();
    drop(file);

    // Ensure at least 1s passes so accessed_at < cutoff
    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    let result = manager.cleanup(None, 0).await.unwrap();
    assert_eq!(result.removed_files, 1);
    assert!(result.freed_bytes > 0);
}

#[tokio::test]
async fn test_cleanup_skips_complete() {
    let (manager, _dir) = create_test_manager().await;

    let (mut file, _existing) = manager
        .create_download("keep", "https://example.com/keep.bin", None, 0)
        .await
        .unwrap();
    file.write_all(b"keep me").await.unwrap();
    drop(file);

    manager.mark_complete("keep", "bin").await.unwrap();

    let result = manager.cleanup(None, 0).await.unwrap();
    assert_eq!(result.removed_files, 0);

    assert!(manager.get_metadata("keep").await.is_ok());
}

#[tokio::test]
async fn test_cleanup_by_namespace() {
    let (manager, _dir) = create_test_manager().await;

    let (mut f1, _existing) = manager
        .create_download("ns1", "https://example.com/a.bin", None, 0)
        .await
        .unwrap();
    f1.write_all(b"a").await.unwrap();
    drop(f1);

    tokio::time::sleep(std::time::Duration::from_secs(1)).await;
    let result = manager.cleanup(Some("downloads"), 0).await.unwrap();
    assert_eq!(result.removed_files, 1);

    let result_none = manager.cleanup(Some("other"), 0).await.unwrap();
    assert_eq!(result_none.removed_files, 0);
}
