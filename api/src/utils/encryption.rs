use aes_gcm::{
    aead::{Aead, KeyInit},
    Aes256Gcm, Key, Nonce,
};
use base64::{Engine as _, engine::general_purpose};
use rand::RngCore;
use crate::error::{Error, Result};

pub struct EncryptionService {
    cipher: Aes256Gcm,
}

impl EncryptionService {
    pub fn new(key: &str) -> Result<Self> {
        // Use the first 32 bytes of the key hash for AES-256
        let key_hash = format!("{:0<64}", key); // Pad key to at least 64 chars
        let key_bytes = key_hash.as_bytes();
        let aes_key = Key::<Aes256Gcm>::from_slice(&key_bytes[..32]);
        
        let cipher = Aes256Gcm::new(aes_key);
        
        Ok(Self { cipher })
    }

    pub fn encrypt(&self, plaintext: &str) -> Result<String> {
        // Generate a random nonce
        let mut nonce_bytes = [0u8; 12];
        rand::thread_rng().fill_bytes(&mut nonce_bytes);
        let nonce = Nonce::from_slice(&nonce_bytes);

        // Encrypt the plaintext
        let ciphertext = self.cipher
            .encrypt(nonce, plaintext.as_bytes())
            .map_err(|e| Error::BadRequest(format!("Encryption failed: {}", e)))?;

        // Combine nonce + ciphertext and encode as base64
        let mut encrypted_data = nonce_bytes.to_vec();
        encrypted_data.extend_from_slice(&ciphertext);
        
        Ok(general_purpose::STANDARD.encode(&encrypted_data))
    }

    pub fn decrypt(&self, encrypted_data: &str) -> Result<String> {
        // Decode from base64
        let data = general_purpose::STANDARD
            .decode(encrypted_data)
            .map_err(|e| Error::BadRequest(format!("Invalid encrypted data: {}", e)))?;

        if data.len() < 12 {
            return Err(Error::BadRequest("Invalid encrypted data length".to_string()));
        }

        // Split nonce and ciphertext
        let (nonce_bytes, ciphertext) = data.split_at(12);
        let nonce = Nonce::from_slice(nonce_bytes);

        // Decrypt
        let plaintext = self.cipher
            .decrypt(nonce, ciphertext)
            .map_err(|e| Error::BadRequest(format!("Decryption failed: {}", e)))?;

        String::from_utf8(plaintext)
            .map_err(|e| Error::BadRequest(format!("Invalid UTF-8: {}", e)))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_encrypt_decrypt() {
        let encryption_service = EncryptionService::new("test-key-123").unwrap();
        let plaintext = "sensitive data";

        let encrypted = encryption_service.encrypt(plaintext).unwrap();
        let decrypted = encryption_service.decrypt(&encrypted).unwrap();

        assert_eq!(plaintext, decrypted);
    }

    #[test]
    fn test_different_keys_fail() {
        let service1 = EncryptionService::new("key1").unwrap();
        let service2 = EncryptionService::new("key2").unwrap();
        
        let plaintext = "sensitive data";
        let encrypted = service1.encrypt(plaintext).unwrap();
        
        // Decryption with different key should fail
        assert!(service2.decrypt(&encrypted).is_err());
    }
}