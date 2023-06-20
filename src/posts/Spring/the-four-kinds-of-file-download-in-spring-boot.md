---
title: Spring Boot中4种文件下载方法的实现
date: 2023-05-19 17:10:36
tag:
  - Spring Boot
category: Spring
description: Spring Boot中分别返回ResponseEntity<InputStreamResource>、ResponseEntity<Resource>、ResponseEntity<StreamingResponseBody>、HttpServletResponse.getOutputStream()4种文件下载方法的实现
---

本篇文章介绍Spring Boot中分别返回`ResponseEntity<InputStreamResource>`、`ResponseEntity<Resource>`、`ResponseEntity<StreamingResponseBody>`、`HttpServletResponse.getOutputStream()`4种文件下载方法的实现。

<!-- more -->

先看看Controller比较直观的展示效果：

```java
@RestController
@RequestMapping("v1/api/file")
public class FileController {
    // spring 注入泛型接口实现
    private final DownLoadFileService<InputStreamResource> isrDownLoadFileService;
    private final DownLoadFileService<Resource> rDownLoadFileService;
    private final DownLoadFileService<StreamingResponseBody> srbDownLoadFileService;
    private final DownLoadFileService srDownLoadFileService;

    public FileController(DownLoadFileService<InputStreamResource> isrDownLoadFileService, DownLoadFileService<Resource> rDownLoadFileService, DownLoadFileService<StreamingResponseBody> srbDownLoadFileService, DownLoadFileService srDownLoadFileService) {
        this.isrDownLoadFileService = isrDownLoadFileService;
        this.rDownLoadFileService = rDownLoadFileService;
        this.srbDownLoadFileService = srbDownLoadFileService;
        this.srDownLoadFileService = srDownLoadFileService;
    }
    
    @RequestMapping(value = "/download1", method = RequestMethod.GET,produces = {MediaType.APPLICATION_OCTET_STREAM_VALUE})
    @SneakyThrows
    public ResponseEntity<InputStreamResource> downloadFile1(String id){
        return isrDownLoadFileService.downloadFile(id);
    }

    @RequestMapping(value = "/download2", method = RequestMethod.GET, produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @SneakyThrows
    public ResponseEntity<Resource> downloadFile2(String id) {
        return rDownLoadFileService.downloadFile(id);
    }

    @GetMapping(value = "/download3", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> downloadFile3(@RequestParam(name = "id") String id) {
        return srbDownLoadFileService.downloadFile(id);
    }

    @GetMapping(value = "/download4")
    public void downloadFile4(@RequestParam(name = "id") String id) {
        srDownLoadFileService.downloadFile(id);
    }

}
```

### 前言

springboot：2.3.9.RELEASE

mybatis-plus: 3.5.2

本文的文件访问依赖使用minioClient，所有的InputStream都来自`minioTemplate.get(thirdFile.getName());`，篇幅有限，访问minio具体实现也比较简单就不在本文中介绍，也可以使用其它方式比如本地文件获取文件输入流InputStream。

<span style="color:red">其实本文介绍的这几种方式原理都是一样的，最终都是往HttpServletResponse输出流，由此还可以做出更多的变通，比如还可以返回`ResponseEntity<ByteArrayResource> 、ResponseEntity<byte[]>等`</span>，这里可以去看看ResponseEntity的原理：

ResponseEntity对应一个http请求或者响应，可以用在controller的返回值里，方便处理header及status。而通常使用的`@ResponseBody`注解，只能处理body部分。这也是为什么通常在下载场景中会使用ResponseEntity，因为下载需要设置header里的content-type以及特殊的status（比如206）。

ResponseEntity类型的返回值由一个特殊的HttpEntityMethodProcessor类型的returnTypeHandler来处理，主要是将ResponseEntity里设置的header和status写入到httpResponse中，body部分调用的是父类的模板方法。

### 必需的配置

1. <span style="color:red"> 添加HttpMessageConverter转换器配置</span>

   > 不添加会报错：`springboot no converter for [class org.springframework.core.io.inputstreamresource] with preset content-type '.....']`
   >
   > 报这个错误的原因大概就是我们在Controller层使用`@RestController`注解，这个注解包含`@ResponseBody`注解，`AbstractMessageConverterMethodProcessor`类的子类`RequestResponseBodyMethodProcessor`是用来处理`@Responsebody`注解的，而`HttpEntityMethodProcessor`是`AbstractMessageConverterMethodProcessor`的另一个子类，该processor专门处理返回值类型是ResponseEntity类型的controller返回值。
   >
   > 所以按照原理来说，不使用`@RestController`和`@Responsebody`注解就可以不用添加这个HttpMessageConverter转换器配置，但是我这里不知道为啥即使不使用`@RestController`注解还是要必须添加这个转换器配置才行。有懂的老铁欢迎评论。

   ```java
   @Configuration
   public class WebMVCConfig implements WebMvcConfigurer {
   
       public void    configureMessageConverters(List<HttpMessageConverter<?>> converters) {
           ResourceHttpMessageConverter resHttpMessageConverter = new ResourceHttpMessageConverter();
           final List<MediaType> list = new ArrayList<>();
           list.add(MediaType.IMAGE_JPEG);
           list.add(MediaType.IMAGE_PNG);
           list.add(MediaType.APPLICATION_OCTET_STREAM);
           resHttpMessageConverter.setSupportedMediaTypes(list);
           converters.add(resHttpMessageConverter);
       }
   }
   ```

2. 使用到的实体和Mapper

   ```java
   import com.baomidou.mybatisplus.core.mapper.BaseMapper;
   import org.apache.ibatis.annotations.Mapper;
   
   @Mapper
   public interface FileMapper extends BaseMapper<ThirdFile> {
   }
   ```

   ```java
   import com.alibaba.fastjson.annotation.JSONField;
   import com.baomidou.mybatisplus.annotation.IdType;
   import com.baomidou.mybatisplus.annotation.TableField;
   import com.baomidou.mybatisplus.annotation.TableId;
   import com.baomidou.mybatisplus.annotation.TableName;
   import lombok.Builder;
   import lombok.Data;
   
   @TableName("third_file")
   @Data
   @Builder
   public class ThirdFile {
       @TableId(value = "id",type = IdType.INPUT)
       private String id;
   
       @TableField("name")
       private String name;
   
       @TableField("size")
       private Long size;
   
       @TableField("version")
       private Integer version;
   
       @TableField("create_time")
       @JSONField(name = "create_time")
       private Long createTime;
   
       @TableField("update_time")
       @JSONField(name = "update_time")
       private Long updateTime;
   }
   ```

### 定义泛型接口

```java
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import java.io.UnsupportedEncodingException;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;

public interface DownLoadFileService<T> {

    ResponseEntity<T> downloadFile(String id);

    default HttpHeaders getHttpHeaders(String filename) throws UnsupportedEncodingException {
        HttpHeaders headers = new HttpHeaders();
        headers.add(HttpHeaders.CONTENT_DISPOSITION, String.format("attachment; filename=\"%s\"", URLEncoder.encode(filename, StandardCharsets.UTF_8.name())));
        headers.add(HttpHeaders.CACHE_CONTROL, "no-cache, no-store, must-revalidate");
        headers.add(HttpHeaders.PRAGMA, "no-cache");
        headers.add(HttpHeaders.EXPIRES, "0");
        return headers;
    }
}
```

### 具体实现

#### 第一种:返回InputStreamResource

```java
import lombok.SneakyThrows;
import lombok.extern.log4j.Log4j2;
import org.springframework.core.io.InputStreamResource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import javax.servlet.ServletContext;
import java.io.InputStream;

@Log4j2
@Service
public class InputStreamResourceDownService implements DownLoadFileService<InputStreamResource> {


    private final MinioTemplate minioTemplate;
    private final FileMapper fileMapper;
    private final ServletContext servletContext;

    public InputStreamResourceDownService(MinioTemplate minioTemplate, FileMapper fileMapper, ServletContext servletContext) {
        this.minioTemplate = minioTemplate;
        this.fileMapper = fileMapper;
        this.servletContext = servletContext;
    }

    @SneakyThrows
    @Override
    public ResponseEntity<InputStreamResource> downloadFile(String id) {
        ThirdFile thirdFile = fileMapper.selectById(id);
        InputStream inputStream = minioTemplate.get(thirdFile.getName());
        InputStreamResource inputStreamResource = new InputStreamResource(inputStream);

        String fileName = thirdFile.getName();
        MediaType mediaType = MediaTypeUtils.getMediaTypeForFileName(this.servletContext, fileName);
        log.info("fileName: " + fileName);
        log.info("mediaType: " + mediaType);

        return ResponseEntity
                .ok()
                .headers(getHttpHeaders(fileName))
                .contentLength(thirdFile.getSize())
                .contentType(mediaType)
                .body(inputStreamResource);
    }
}
```

#### 第二种:返回Resource

```java
import lombok.SneakyThrows;
import org.springframework.core.io.ByteArrayResource;
import org.springframework.core.io.Resource;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import java.io.ByteArrayOutputStream;
import java.io.InputStream;

@Service
public class ResourceDownLoadService implements DownLoadFileService<Resource> {

    private final MinioTemplate minioTemplate;
    private final FileMapper fileMapper;

    public ResourceDownLoadService(MinioTemplate minioTemplate, FileMapper fileMapper) {
        this.minioTemplate = minioTemplate;
        this.fileMapper = fileMapper;
    }

    @SneakyThrows
    @Override
    public ResponseEntity<Resource> downloadFile(String id) {
        ThirdFile thirdFile = fileMapper.selectById(id);
        InputStream inputStream = minioTemplate.get(thirdFile.getName());
        // 读取 InputStream 的数据到字节数组中
        ByteArrayOutputStream outputStream = new ByteArrayOutputStream();
        byte[] buffer = new byte[4096];
        int bytesRead;
        while ((bytesRead = inputStream.read(buffer)) != -1) {
            outputStream.write(buffer, 0, bytesRead);
        }
        byte[] fileBytes = outputStream.toByteArray();

        return ResponseEntity.ok()
                .headers(getHttpHeaders(thirdFile.getName()))
                .contentLength(fileBytes.length)
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(new ByteArrayResource(fileBytes));
    }
}
```

#### 第三种:返回StreamingResponseBody

```java
import lombok.SneakyThrows;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;
import org.springframework.util.StreamUtils;
import org.springframework.web.servlet.mvc.method.annotation.StreamingResponseBody;

import java.io.IOException;
import java.io.InputStream;

@Service
public class StreamingResponseBodyDownLoadService implements DownLoadFileService<StreamingResponseBody> {
    private final MinioTemplate minioTemplate;
    private final FileMapper fileMapper;

    public StreamingResponseBodyDownLoadService(MinioTemplate minioTemplate, FileMapper fileMapper) {
        this.minioTemplate = minioTemplate;
        this.fileMapper = fileMapper;
    }

    @SneakyThrows
    @Override
    public ResponseEntity<StreamingResponseBody> downloadFile(String id) {

        ThirdFile thirdFile = fileMapper.selectById(id);
        InputStream inputStream = minioTemplate.get(thirdFile.getName());

        return ResponseEntity.ok()
                .headers(getHttpHeaders(thirdFile.getName()))
                .contentType(MediaType.APPLICATION_OCTET_STREAM)
                .body(outputStream -> {
                    try (InputStream inputStream2 = inputStream) {
                        StreamUtils.copy(inputStream2, outputStream);
                    } catch (IOException ignored) {

                    }
                });
    }
}
```

#### 第四种:返回HttpServletResponse输出流

```java
import org.springframework.http.HttpHeaders;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Service;

import javax.servlet.ServletContext;
import javax.servlet.http.HttpServletResponse;
import java.io.BufferedInputStream;
import java.io.BufferedOutputStream;
import java.io.InputStream;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;


@Log4j2
@Service("srDownLoadFileService")
public class ServletResponseDownService implements DownLoadFileService {

    private final MinioTemplate minioTemplate;
    private final FileMapper fileMapper;
    private final ServletContext servletContext;
    private final HttpServletResponse response;

    public ServletResponseDownService(MinioTemplate minioTemplate, FileMapper fileMapper, ServletContext servletContext, HttpServletResponse response) {
        this.minioTemplate = minioTemplate;
        this.fileMapper = fileMapper;
        this.servletContext = servletContext;
        this.response = response;
    }

    @SneakyThrows
    @Override
    public ResponseEntity downloadFile(String id) {
        ThirdFile thirdFile = fileMapper.selectById(id);
        InputStream inputStream = minioTemplate.get(thirdFile.getName());
        String fileName = thirdFile.getName();
        MediaType mediaType = MediaTypeUtils.getMediaTypeForFileName(this.servletContext, fileName);
        log.info("fileName: " + fileName);
        log.info("mediaType: " + mediaType);

        // Content-Type, eg: application/pdf
        response.setContentType(mediaType.getType());

        // Content-Disposition
        response.setHeader(HttpHeaders.CONTENT_DISPOSITION, "attachment;filename=" + URLEncoder.encode(fileName, StandardCharsets.UTF_8.name()));

        // Content-Length
        response.setContentLength(Math.toIntExact(thirdFile.getSize()));

        BufferedInputStream inStream = new BufferedInputStream(inputStream);
        BufferedOutputStream outStream = new BufferedOutputStream(response.getOutputStream());

        byte[] buffer = new byte[1024];
        int bytesRead = 0;
        while ((bytesRead = inStream.read(buffer)) != -1) {
            outStream.write(buffer, 0, bytesRead);
        }
        outStream.flush();
        inStream.close();
        return null;
    }
}
```

### Spring注入泛型接口使用

```java
@Log4j2
@RestController
@RequestMapping("v1/api/file")
public class FileController {

    // 泛型接口注入
    private final DownLoadFileService<InputStreamResource> isrDownLoadFileService;
    private final DownLoadFileService<Resource> rDownLoadFileService;
    private final DownLoadFileService<StreamingResponseBody> srbDownLoadFileService;
    private final DownLoadFileService srDownLoadFileService;

    public FileController(DownLoadFileService<InputStreamResource> isrDownLoadFileService, DownLoadFileService<Resource> rDownLoadFileService, DownLoadFileService<StreamingResponseBody> srbDownLoadFileService, DownLoadFileService srDownLoadFileService) {
        this.isrDownLoadFileService = isrDownLoadFileService;
        this.rDownLoadFileService = rDownLoadFileService;
        this.srbDownLoadFileService = srbDownLoadFileService;
        this.srDownLoadFileService = srDownLoadFileService;
    }

    @RequestMapping(value = "/download1", method = RequestMethod.GET,produces = {MediaType.APPLICATION_OCTET_STREAM_VALUE})
    @SneakyThrows
    public ResponseEntity<InputStreamResource> downloadFile1(String id){
        return isrDownLoadFileService.downloadFile(id);
    }

    @RequestMapping(value = "/download2", method = RequestMethod.GET, produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    @SneakyThrows
    public ResponseEntity<Resource> downloadFile2(String id) {
        return rDownLoadFileService.downloadFile(id);
    }

    @GetMapping(value = "/download3", produces = MediaType.APPLICATION_OCTET_STREAM_VALUE)
    public ResponseEntity<StreamingResponseBody> downloadFile3(@RequestParam(name = "id") String id) {
        return srbDownLoadFileService.downloadFile(id);
    }


    @GetMapping(value = "/download4")
    public void downloadFile4(@RequestParam(name = "id") String id) {
        srDownLoadFileService.downloadFile(id);
    }


}
```



### 参考：

[some ways for creating the file downloading function](https://o7planning.org/11765/spring-boot-file-download)

[How to solve "No converter for class B with preset Content-Type 'image/png'" error in Spring when trying to serve an image?](https://stackoverflow.com/questions/73476729/how-to-solve-no-converter-for-class-b-with-preset-content-type-image-png)

[ResponseEntity 使用 及 原理](https://blog.csdn.net/u010900754/article/details/105329256)

[springboot 使用ResponseEntity实现文件流下载](https://blog.csdn.net/zhoudingding/article/details/121394005)

[SpringBoot中文件二进制流下载功能Api](https://www.cnblogs.com/dafei4/p/16213048.html)

[Java- 泛型机制详解](https://blog.csdn.net/Day_and_Night_2017/article/details/115609322)

[java 泛型详解](https://blog.csdn.net/s10461/article/details/53941091)

[Spring 框架：泛型接口的自动注入](https://blog.csdn.net/Day_and_Night_2017/article/details/115609322)