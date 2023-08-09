---
title: '关于docker jdk1.8镜像中的GB18030-2022标准支持及验证'
date: 2023-08-08 18:03:28
tag:
  - Docker
  - GB18030-2022
category: 云原生
---

[国家标准《信息技术 中文编码字符集GB18030-2022》](https://std.samr.gov.cn/gb/search/gbDetailed?id=E4A2A4C875726A5DE05397BE0A0A61E8)发布于 2022-07-19并于2023-08-01正式实施，需要对系统编码支持进行改造升级。本文介绍关于在K8s/Docker云环境背景，在jdk1.8环境下容器镜像中的GB18030-2022标准支持及验证。

<!-- more -->

先说结论，openjdk官方在8u381 这个版本对GB18030-2022进行了支持，参见：https://bugs.openjdk.org/browse/JDK-8301119  ，对应github地址：https://github.com/openjdk/jdk/pull/12518  在该Bugs报告记录中还可以发现8u381、8u39、openjdk8u382、openjdk8u392 、11.0.20、17.0.8、20.0.2对其都进行了修复。

对于JDK1.8已支持GB18030-2022的对应镜像如下：

OpenJDK官方镜像：adoptopenjdk/openjdk8:x86_64-debian-jdk8u382-b05    [更新日志](https://builds.shipilev.net/backports-monitor/parity-8.html)

OracleJDK镜像：container-registry.oracle.com/java/jdk:8u381-oraclelinux8 （需要[注册登录](https://docs.oracle.com/cd/F41560_01/docker_atp_install_guides/admin_console_deployment_guide_for_tomee/Content/Docker_ATP%20Documents/Admin%20Console%20Doeployment%20for%20TomEE/Pull%20the%20Oracle%20Java%20Base%20Image.htm)后拉取） [更新日志](https://www.oracle.com/java/technologies/javase/8all-relnotes.html)



关于验证：

自定义一个CharsetSupportValidation.java小程序，根据输入的charsetName进行转换`Charset charset = Charset.forName(charsetName);`如果抛出UnsupportedCharsetException则不支持这个编码集。

另外还尝试进行编码和解码操作，看能否正常转换编码。比如如下步骤验证的是输入一串Unicode编码看能否正常转换为GB18030-2022编码。（`\u9fec`是[国家标准|GB 18030-2022 (samr.gov.cn)](https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=A1931A578FE14957104988029B0833D3)第164/746页一个新增的中文字符，unicode编码为9fec，GB18030-2022编码为82359633）。如下Original和Decoded显示一个空白框猜测是容器中的linux环境不支持造成的。

```bash
root@Ubuntu:~/dockerfiles/javabase# docker run --rm -it container-registry.oracle.com/java/jdk:8u381-oraclelinux8 /bin/bash
[root@884b90c73fb1 /]#
[root@884b90c73fb1 /]# vi CharsetSupportValidation.java
[root@884b90c73fb1 /]# javac CharsetSupportValidation.java
[root@884b90c73fb1 /]# java CharsetSupportValidation GB18030-2022 \u9fec
Charset GB18030-2022 is supported.
Original: 鿬
Encoded bytes: 82359633
Decoded: 鿬
```

CharsetSupportValidation.java代码如下

```java
import java.nio.charset.Charset;
import java.nio.charset.UnsupportedCharsetException;

public class CharsetSupportValidation {
    public static void main(String[] args) {
        if (args.length != 2) {
            System.out.println("Usage: java CharsetSupportValidation <charset> <unicode>");
            return;
        }

        String charsetName = args[0];
        String testString = unescapeUnicode(args[1]);

        try {
            Charset charset = Charset.forName(charsetName);

            // 尝试编码和解码操作
            byte[] encodedBytes = testString.getBytes(charset);
            String decodedString = new String(encodedBytes, charset);

            System.out.println("Charset " + charsetName + " is supported.");
            System.out.println("Original: " + testString); // 原始字符串
            // 将字符串转为指定的charset字符集的编码
            System.out.println("Encoded bytes: " + bytesToHexString(decodedString.getBytes(charset))); 
            System.out.println("Decoded: " + decodedString); // 将字符串通过charset字符集编码后的字符串
        } catch (UnsupportedCharsetException e) {
            System.out.println("Charset " + charsetName + " is not supported.");
        }
    }

    // 将字节数组转换为十六进制字符串
    public static String bytesToHexString(byte[] bytes) {
        StringBuilder hexString = new StringBuilder();
        for (byte b : bytes) {
            String hex = Integer.toHexString(b & 0xFF);
            if (hex.length() == 1) {
                hexString.append('0'); // 确保两位十六进制表示
            }
            hexString.append(hex);
        }
        return hexString.toString();
    }

    // Convert Unicode escape sequence to character
    public static String unescapeUnicode(String input) {
        StringBuilder result = new StringBuilder();
        int length = input.length();
        for (int i = 0; i < length; i++) {
            char currentChar = input.charAt(i);
            if (currentChar == '\\' && i + 1 < length && input.charAt(i + 1) == 'u') {
                // Found a Unicode escape sequence
                String hexDigits = input.substring(i + 2, i + 6);
                char unicodeChar = (char) Integer.parseInt(hexDigits, 16);
                result.append(unicodeChar);
                i += 5; // Skip the rest of the escape sequence
            } else {
                result.append(currentChar);
            }
        }
        return result.toString();
    }
}
```



续：在unicode官方还发现一篇关于[GB 18030-2022的征求意见稿](https://www.unicode.org/L2/L2023/23113-gb18030-2022-amd-draft1.pdf)，里面包含了目前发布的[国家标准|GB 18030-2022 (samr.gov.cn)](https://openstd.samr.gov.cn/bzgk/gb/newGbInfo?hcno=A1931A578FE14957104988029B0833D3)中未包含的一些字符
