package team.carrypigeon.backend.connection.protocol.encryption.ecc;

import lombok.extern.slf4j.Slf4j;
import org.bouncycastle.jce.ECNamedCurveTable;
import org.bouncycastle.jce.provider.BouncyCastleProvider;
import org.bouncycastle.jce.spec.ECParameterSpec;

import javax.crypto.BadPaddingException;
import javax.crypto.Cipher;
import javax.crypto.IllegalBlockSizeException;
import javax.crypto.NoSuchPaddingException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import java.security.*;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;

/**
 * 圆锥曲曲线加密工具类
 * @author midreamsheep
 * */
@Slf4j
public class ECCUtil {

    // 设置算法
    private static final String ALGORITHM = "EC";
    // 设置提供者
    private static final String PROVIDER = "BC";
    // 设置transformation
    private static final String TRANSFORMATION = "ECIES";
    // 设置圆锥曲线参数
    private static final ECParameterSpec ecSpec = ECNamedCurveTable.getParameterSpec("secp256r1");

    static {
        Security.addProvider(new BouncyCastleProvider());
    }

    /**
     * 获取椭圆曲线密钥对
     * @return 密钥对
     * */
    public static KeyPair generateEccKeyPair() {
        KeyPairGenerator keyPairGenerator;
        try {
            keyPairGenerator = KeyPairGenerator.getInstance(ALGORITHM, PROVIDER);
            keyPairGenerator.initialize(ecSpec, new SecureRandom());
        } catch (InvalidAlgorithmParameterException | NoSuchAlgorithmException | NoSuchProviderException e) {
            log.error("unexpected exception while generating ECC key pair: {}", e.getMessage(), e);
            throw new RuntimeException(e);
        }
        return keyPairGenerator.generateKeyPair();
    }

    /**
     * 椭圆曲线加密
     * @param plainText 明文
     * @param publicKey 公钥
     * @return 密文
     * */
    public static byte[] encrypt(String plainText, PublicKey publicKey) {
        try {
            Cipher cipher = Cipher.getInstance(TRANSFORMATION, PROVIDER);
            cipher.init(Cipher.ENCRYPT_MODE, publicKey);
            return cipher.doFinal(plainText.getBytes());
        } catch (NoSuchAlgorithmException | NoSuchProviderException | NoSuchPaddingException | InvalidKeyException |
                 IllegalBlockSizeException | BadPaddingException e) {
            log.error("unexpected exception while encrypting with ECC: {}", e.getMessage(), e);
            throw new RuntimeException(e);
        }
    }

    /**
     * 椭圆曲线解密<br/>
     * 若抛出异常，请检查密钥对是否正确，解密错误
     * @param encryptedBytes 密文
     * @param privateKey 私钥
     * @return 明文
     * */
    public static String decrypt(byte[] encryptedBytes, PrivateKey privateKey) throws Exception{
        Cipher cipher = Cipher.getInstance(TRANSFORMATION, PROVIDER);
        cipher.init(Cipher.DECRYPT_MODE, privateKey);
        return new String(cipher.doFinal(encryptedBytes));
    }

    /**
     * 重建公钥
     * @param publicKeyBase64 公钥Base64
     * @return 公钥
     * */
    public static PublicKey rebuildPublicKey(String publicKeyBase64) throws Exception {
        // 先进行Base64解码
        byte[] publicKeyBytes = Base64.getDecoder().decode(publicKeyBase64);
        // 然后使用X509EncodedKeySpec重建公钥
        X509EncodedKeySpec spec = new X509EncodedKeySpec(publicKeyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance(ALGORITHM, PROVIDER);
        return keyFactory.generatePublic(spec);
    }

    /**
     * 重建私钥
     * @param privateKeyBase64 私钥Base64（PKCS#8）
     * @return 私钥
     */
    public static PrivateKey rebuildPrivateKey(String privateKeyBase64) throws Exception {
        byte[] privateKeyBytes = Base64.getDecoder().decode(privateKeyBase64);
        PKCS8EncodedKeySpec spec = new PKCS8EncodedKeySpec(privateKeyBytes);
        KeyFactory keyFactory = KeyFactory.getInstance(ALGORITHM, PROVIDER);
        return keyFactory.generatePrivate(spec);
    }
}
