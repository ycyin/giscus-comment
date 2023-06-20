---
title: 通过resteasy发布RESTful接口
date: 2021-04-19 18:47:02
tag:
  - resteasy
  - RESTful
category: Web技术&权限
---

## 开发环境

- IntelliJ IDEA 2020.3.2
- org.jboss.resteasy 4.6.0.Final
- JDK1.8
- Tomcat 9.0.37

在此之前，你可能听过Spring 3中的REST特性或者用过它开发过HTML Web应用。有必要指出JAX-RS的目标是Web Services开发（这与HTML Web应用不同）而Spring MVC的目标则是Web应用开发。Spring 3为Web应用与Web Services增加了广泛的REST支持。

要说明的第二点是我们将要讨论的REST特性是Spring Framework的一部分，也是现有的Spring MVC编程模型的延续，因此，并没有所谓的“Spring REST framework”这种概念，有的只是Spring和Spring MVC。这意味着如果你有一个Spring应用的话，你既可以使用Spring MVC创建HTML Web层，也可以创建RESTful Web Services层。

## JAX-RS是什么
Java EE 6 引入了对 JSR-311 的支持。JSR-311（JAX-RS：JavaAPI for RESTful Web Services）旨在定义一个统一的规范，使得 Java 程序员可以使用一套固定的接口来开发 REST 应用，**避免了依赖于第三方框架**。同时，JAX-RS 使用 POJO 编程模型和基于标注的配置，并集成了JAXB，从而可以**有效缩短 REST 应用的开发周期**。

JAX-RS是一套用java实现REST服务的规范，提供了一些标注将一个资源类，一个POJOJava类，封装为Web资源. 这些标注包括以下：

- @Path：标注资源类或方法的相对路径。

- @GET，@PUT，@POST，@DELETE：标注方法是用的HTTP请求的类型。

- @Produces：标注返回的MIME媒体类型。

- @Consumes：标注可接受请求的MIME媒体类型。

- @PathParam，@QueryParam，@HeaderParam，@CookieParam，@MatrixParam，@FormParam：分别标注方法的参数来自于HTTP请求的不同位置，例如@PathParam来自于URL的路径，@QueryParam来自于URL的查询参数，@HeaderParam来自于HTTP请求的头信息，@CookieParam来自于HTTP请求的Cookie。

更通俗些说如果你用java写了一套框架，当开发者自己写的JAVA类使用了JAX-RS定义的这些注解标注过，然后通过你写的这套框架就可以将有这些JAX-RS标注的类发布成web资源，供其他客户端程序去调用。那么你写的这套框架就是一套RestFul Web Service框架，就是JAX-RS规范的实现者之一，是JAX-RS标准定义的这些标注的解释执行者。

目前比较流行的JAX-RS实现有以下几种：

1. Apache CXF，开源的Web服务框架开源组织Apache的实现。

2. Jersey，由Sun提供的JAX-RS的参考实现。

3. RestEasy，JBoss的JAX-RS的实现。

与其他几个框架相比较而言，RestEasy以其高性能，轻量级，简单易上手，高可靠性和稳定性以及易于与其他容器集成等特点，越来越受到开发人员的欢迎。

## Resteasy简介

RESTEasy是JBoss的一个开源项目，提供一套完整的框架帮助开发人员构建RESTful Web Service和RESTful Java应用程序。它是JAX-RS 2.0规范的一个完整实现并通过JCP认证，通过Http协议对外提供基于Java API的 RestFul Web Service。

RestEasy可以运行在任何Servlet容器中，作为JBoss的官方实现它可以更好的和Jboss服务器紧密融合从而提供更好的用户体验。

JBoss RESTEasy 是一个用来使用Java语言开发 RESTFul Web服务的框架。

RESTEasy 项目是 JAX-RS 的一个实现，集成的一些亮点：

  1）不需要配置文件，只要把JARs文件放到类路径里面，添加 @Path等标注就可以了

  2）完全的把 RESTEeasy 配置作为Seam 组件来看待

  3）HTTP 请求由Seam来提供，不需要一个额外的Servlet

  4）Resources 和providers可以作为Seam components (JavaBean or EJB)，具有全面的Seaminjection,lifecycle, interception, 等功能支持

  5）支持在客户端与服务器端自动实现GZIP解压缩 

  6）支持异步请求处理

  7）支持多种数据传输格式: XML, JSON, YAML, Fastinfoset, Multipart, XOP, Atom

  ……

## 简单实践

这里使用org.jboss.resteasy 4.6.0.Final版本，我这边实践使用JDK1.8部署到tomcat9.0中可正常运行。点击<a :href="$withBase('/code/RestEasyDemo.zip')" download="RestEasyDemo.zip">这里下载完整Demo</a>。

使用IDEA新建一个maven构建的简单Web应用。然后简单的编辑几个文件便可发布RESTful接口。

**pom.xml**：

```xml
    <dependency>
      <groupId>org.jboss.resteasy</groupId>
      <artifactId>resteasy-core</artifactId>
      <version>4.6.0.Final</version>
    </dependency>
    <dependency>
      <groupId>org.jboss.resteasy</groupId>
      <artifactId>resteasy-jaxb-provider</artifactId>
      <version>4.6.0.Final</version>
    </dependency>
    <dependency>
      <groupId>org.jboss.resteasy</groupId>
      <artifactId>resteasy-servlet-initializer</artifactId>
      <version>4.6.0.Final</version>
    </dependency>
```

**测试类**：

即发布出去的接口，在[官方文档中](https://docs.jboss.org/resteasy/docs/4.6.0.Final/userguide/html_single/index.html)详细的讲解了更多具体注解的作用和用法。

```java
package com.yyc;

import org.jboss.resteasy.annotations.jaxrs.PathParam;
import org.jboss.resteasy.annotations.jaxrs.QueryParam;

import javax.ws.rs.DELETE;
import javax.ws.rs.GET;
import javax.ws.rs.PUT;
import javax.ws.rs.Path;

@Path("/library")
public class Library {

   @GET
   @Path("/books")
   public String getBooks() {
      return "books";
   }

   @GET
   @Path("/book/{isbn}")
   public String getBook(@PathParam("isbn") String id) {
      // search my database and get a string representation and return it
      return "book"+id;
   }

   @PUT
   @Path("/book/{isbn}")
   public void addBook(@PathParam("isbn") String id, @QueryParam("name") String name) {
      System.out.println(id+"/"+name);
   }

   @DELETE
   @Path("/book/{id}")
   public void removeBook(@PathParam("id") String id ){
      System.out.println(id);
   }
   
}
```

**web.xml**：

[官方文档中](https://docs.jboss.org/resteasy/docs/4.6.0.Final/userguide/html_single/index.html#classic_config)提到，RestEasy可以作为Servlet调用(如下配置方式)，也可以作为Fliter调用，甚至ServletContextListener。

```xml
<web-app version="3.0" xmlns="http://java.sun.com/xml/ns/javaee"
         xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
         xsi:schemaLocation="http://java.sun.com/xml/ns/javaee http://java.sun.com/xml/ns/javaee/web-app_3_0.xsd">

  <context-param>
    <param-name>resteasy.resources</param-name>
    <param-value>com.yyc.Library</param-value>
  </context-param>

  <servlet>
    <servlet-name>Resteasy</servlet-name>
    <servlet-class>org.jboss.resteasy.plugins.server.servlet.HttpServlet30Dispatcher</servlet-class>

    <init-param>
      <param-name>resteasy.resources</param-name>
      <param-value>com.yyc.Library</param-value>
    </init-param>

  </servlet>

  <servlet-mapping>
    <servlet-name>Resteasy</servlet-name>
    <url-pattern>/*</url-pattern>
  </servlet-mapping>
</web-app>
```

**启动**：

然后同普通Web项目一样在Tomcat中启动即可在浏览器访问。http://localhost:8080/RestEasyDemo_war/library/book/1234

<a :href="$withBase('/code/RestEasyDemo.zip')" download="RestEasyDemo.zip">下载完整Demo</a>

## 参考

- 官方4.6.0手册：https://docs.jboss.org/resteasy/docs/4.6.0.Final/userguide/html_single/index.html
- 官方文档：https://resteasy.github.io/docs/
- 官方Demo：https://github.com/resteasy/resteasy-examples
- https://www.oschina.net/p/resteasy

- https://my.oschina.net/u/3920392/blog/4638917
- https://www.cnblogs.com/balaamwe/archive/2012/07/25/2608254.html
- https://www.infoq.com/articles/springmvc_jsx-rs/