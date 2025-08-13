use base64::encode;
use ring::rand::SystemRandom;
use ring::signature::{EcdsaKeyPair, KeyPair};

#[derive(Debug)]
struct Account;

impl Account {
    async fn crate_ecc() -> String {
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

        let public_key = encode(private_key.public_key().clone());

        public_key
    }
}
