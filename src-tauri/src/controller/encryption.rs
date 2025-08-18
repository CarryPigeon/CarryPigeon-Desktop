use aes::{Aes256, Aes256Enc};
use aes::cipher::KeyInit;
use crate::service::net::tcp_service::TCP_SERVICE;
use base64::encode;
use ring::agreement::{PublicKey, ECDH_P256};
use ring::rand::SystemRandom;
use ring::signature::{EcdsaKeyPair, KeyPair};
use ring::{agreement, signature};

#[derive(Debug)]
pub struct Encryption {
    ecc_private_key: EcdsaKeyPair,
    aes_key: String,
}

impl Encryption {
    pub async fn new() -> Self {
        let ecc_private_key = Encryption::crate_ecc().await;
        Self { ecc_private_key, aes_key: String::new() }
    }
    pub async fn crate_ecc() -> EcdsaKeyPair {
        let rng = SystemRandom::new();

        let pkcs8_bytes =
            EcdsaKeyPair::generate_pkcs8(&ring::signature::ECDSA_P256_SHA256_FIXED_SIGNING, &rng)
                .map_err(|e| tracing::error!("Failed to generate PKCS#8: {}", e))
                .unwrap();

        let private_key = EcdsaKeyPair::from_pkcs8(
            &ring::signature::ECDSA_P256_SHA256_FIXED_SIGNING,
            pkcs8_bytes.as_ref(),
            &rng,
        )
        .map_err(|e| tracing::error!("Failed to generate ECC Private Key: {}", e))
        .unwrap();
        let public_key = private_key.public_key();

        private_key
    }

    pub fn prase_aes(&mut self, key:String) {

    }
    pub async fn send_verification(&self, message: String, rsa: &Vec<u8>) {
        unsafe {
            TCP_SERVICE
                .get_mut()
                .unwrap()
                .send_message(encode(Aes256Enc::))
                .await
                .unwrap()
        }
    }
}
