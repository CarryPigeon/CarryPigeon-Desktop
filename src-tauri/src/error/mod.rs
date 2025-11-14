use thiserror::Error;

#[derive(Error, Debug)]
enum CPError {
    #[error("Tokio IO error: {0}")]
    TokioIOError(tokio::io::Error),
    #[error("unknown error")]
    UnknownError,
}
