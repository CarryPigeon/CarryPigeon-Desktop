use std::{fmt::Display, path::Path, str::FromStr};

use chrono::Local;

pub enum FileType {
    Image,
    Video,
    Audio,
    Document,
    Other,
}

impl Display for FileType {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        match self {
            FileType::Image => write!(f, "Image"),
            FileType::Video => write!(f, "Video"),
            FileType::Audio => write!(f, "Audio"),
            FileType::Document => write!(f, "Document"),
            FileType::Other => write!(f, "Other"),
        }
    }
}

impl std::str::FromStr for FileType {
    type Err = &'static str;

    fn from_str(s: &str) -> Result<Self, Self::Err> {
        match s {
            "Image" => Ok(FileType::Image),
            "Video" => Ok(FileType::Video),
            "Audio" => Ok(FileType::Audio),
            "Document" => Ok(FileType::Document),
            "Other" => Ok(FileType::Other),
            _ => Err("Invalid file type"),
        }
    }
}

pub fn file_path_distributor(file_name: String, file_type: String) -> anyhow::Result<String> {
    // 实现文件路径分发逻辑
    //

    let today = Local::now().format("%Y-%m-%d").to_string();

    match FileType::from_str(file_type.as_str()) {
        Ok(file_type) => match file_type {
            FileType::Image => {
                // TODO: 实现图片文件路径分发逻辑
                anyhow::Ok(
                    Path::new(format!("./Image/{}/{}", today, file_name).as_str())
                        .to_str()
                        .unwrap()
                        .to_string(),
                )
            }
            FileType::Video => anyhow::Ok(
                Path::new(format!("./Video/{}/{}", today, file_name).as_str())
                    .to_str()
                    .unwrap()
                    .to_string(),
            ),
            FileType::Audio => anyhow::Ok(
                Path::new(format!("./Audio/{}/{}", today, file_name).as_str())
                    .to_str()
                    .unwrap()
                    .to_string(),
            ),
            FileType::Document => anyhow::Ok(
                Path::new(format!("./Document/{}/{}", today, file_name).as_str())
                    .to_str()
                    .unwrap()
                    .to_string(),
            ),
            FileType::Other => anyhow::Ok(
                Path::new(format!("./Other/{}/{}", today, file_name).as_str())
                    .to_str()
                    .unwrap()
                    .to_string(),
            ),
        },
        Err(err) => {
            tracing::error!("{:?}", err);
            Err(anyhow::anyhow!("Invalid file type"))
        }
    }
}
