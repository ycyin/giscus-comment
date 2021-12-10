---
title: 关于部署于JBoss5中的Spring应用获取项目真实部署路径的问题
date: 2021-12-10 11:03:18
tags:
  - Spring
  - JBoss
categories: Spring
description: 部署于JBoss5中的Spring应用获取项目真实部署路径,使用ContextLoader.getCurrentWebApplicationContext()
---

## 前言
部署于JBoss5中的Spring应用，现需要判断项目中的某一个文件是否存在。首先需要获取项目部署后的真实路径。在JBoss5中war包放于deploy目录中，启动JBoss后会将war包解压到一个tmp目录中的一个随机命名的文件夹中，这个随机命名的文件夹每次重新启动就会重新生成，所以要在项目中获取文件路径就需要动态的获取到JBoss解压war后的目录。

## 实践
项目的访问路径为：`https://域名/develop/access`

在代码中尝试获取真实的部署路径：


```java
String path = this.getClass().getClassLoader().getResource("/").getPath();
logger.info("路径1为："+path);
String path1 = Thread.currentThread().getContextClassLoader().getResource("/").getPath();
logger.info("路径2为："+path1);
WebApplicationContext currentWebApplicationContext = ContextLoader.getCurrentWebApplicationContext();
ServletContext servletContext = currentWebApplicationContext.getServletContext();
logger.info("路径3为："+servletContext.getRealPath("/"));
logger.info("路径4为："+servletContext.getContextPath());
logger.info("路径5为："+servletContext.getRealPath(""));
logger.info("路径6为："+servletContext.getResource("/").getPath());
```

输出： 

```
路径1为：/
路径2为：/
路径3为：/opt/app/jboss-eap-5.0/jboss-as/server/项目server名/tmp/a5261v-b6ytv-kvltazy9-1-kvltblk8-2u/部署包名/
路径4为：/develop/access
路径5为：/opt/app/jboss-eap-5.0/jboss-as/server/项目server名/tmp/a5261v-b6ytv-kvltazy9-1-kvltblk8-2u/部署包名
路径6为：/localhost/develop/access/
```

所以可以使用Spring-web包中的`ContextLoader.getCurrentWebApplicationContext().getServletContext()`获取到项目在JBoss5中真实的部署路径。