---
title: maven配置文件settings.xml中的一些概念总结
date: 2022-08-21 09:50:20
tags:
  - maven
  - 使用技巧
categories: Maven
---

在`settings.xml`文件中有如下几个常用的配置标签：

-   在`<servers></servers>`标签中配置仓库访问账号和密码。

-   在`<mirrors></mirrors>`标签中配置对`profiles`中配置的仓库镜像。

-   在`<profiles></profiles>`标签中配置多仓库使用，配置多个`profile`及其对应的`repositories`。

-   在`<activeProfiles></activeProfiles>`中激活`profiles`中配置的多个`profile`，否则配置无效。

对其中一些使用过程中涉及到的配置理解：

# maven加载配置文件顺序

`settings.xml`是maven的全局配置文件。而`pom.xml`文件是所在项目的局部配置
`settings.xml`文件一般存在于两个位置：
- 全局配置: `${M2_HOME}/conf/settings.xml`
- 用户配置: `user.home/.m2/settings.xml`

用户配置优先于全局配置。局部配置优先于全局配置。配置优先级从高到低：`pom.xml> user settings > global settings`
如果这些文件同时存在，在应用配置时，会合并它们的内容，如果有重复的配置，优先级高的配置会覆盖优先级低的。

# repository和mirror

通常可以在`settings.xml`中看到如下配置：

```xml
  <mirrors>
    <!-- 阿里云仓库 -->
    <mirror>
        <id>alimaven</id>
        <mirrorOf>central</mirrorOf>
        <name>aliyun maven</name>
        <url>http://maven.aliyun.com/nexus/content/repositories/central/</url>
    </mirror>
    <!--重定向到我们自己的私库-->
	<mirror>
	    <id>nexus.yyc.cn</id>
        <!--profile中的repository.id-->
        <mirrorOf>central</mirrorOf>
        <url>https://nexus.yyc.cn/repository/maven-public/</url>
	</mirror>
  </mirrors>
  <profiles>
	<profile>
        <id>repository</id>
        <repositories>
            <repository>
                <id>central</id>
                <url>http://repo1.maven.org/maven2/</url>
                <releases><enabled>true</enabled></releases>
                <snapshots><enabled>true</enabled></snapshots>
            </repository>
        </repositories>
        <pluginRepositories>
            <pluginRepository>
                <id>central</id>
                <url>http://repo1.maven.org/maven2/</url>
                <releases><enabled>true</enabled></releases>
                <snapshots><enabled>true</enabled></snapshots>
            </pluginRepository>
        </pluginRepositories>
    </profile>
  </profiles>
```

maven里的mirror和repository是两个比较容易混淆的概念，它们的作用都是配置远程maven仓库的地址。顾名思义，repository就是直接配置站点地址，mirror则是作为站点的镜像，代理某个或某几个站点的请求，实现对repository的完全代替。

mirror相当于一个拦截器，它会拦截maven对remote repository的相关请求，把请求里的remote repository地址，重定向到mirror里配置的地址。如果repository的id和mirror的mirrorOf的值匹配，则该mirror替代该repository，如果该repository找不到对应的mirror，则使用其本身。

如果`setting.xml`和`pom.xml`里都配置了repository, 配置的mirror是可以对两个配置文件都生效。

与repository不同，配置到同一个repository的多个mirror时，相互之间是备份的关系，只有在仓库连不上的时候才会切换另一个，而如果在能连上的情况下找不到包，是不会尝试下一个地址的。
配置多个repository时maven会按照配置从上到下的顺序，依次尝试从各个地址下载，成功下载为止。

其中`<mirrorOf>`有多种用法，用法示例：
```
* = everything 拦截所有 <repositories>下配置的远程下载请求。

external:* = everything not on the localhost and not file based. 拦截所有本地没有且 <repositories>未配置的请求，换句话说，就是前面都查过，但是查不到的情况下，还会继续从<mirror>中定义的url下载。

repo,repo1 = repo or repo1 拦截指定 <repositories>名称的远程地址请求，从<mirror>中定义的url下载。

*,!repo1 = everything except repo1 拦截除了 <repositories>名称为repo1的远程地址请求，其他均从<mirror>中定义的url下载。
```

其实，mirror表示的是两个Repository之间的关系 即定义了两个Repository之间的镜像关系。配置两个Repository之间的镜像关系，一般是出于访问速度和下载速度考虑。

例如， 有一个项目，需要在公司和住所都编码，并在项目pom.xml配置了A Maven库。在公司，是电信网络，访问A库很快，所以maven管理依赖和插件都从A库下载；在住所，是网通网络，访问A库很慢，但是访问B库很快。这 时，在住所的setting.xml里，只要配置一 下mirror，让B库成为A 库的mirror，即可不用更改项目pom.xml里对于A库的相关配置。

如果该镜像仓库需要认证，则配置setting.xml中的servers即可。

# 关于私库用户密码

```xml
  <servers>
      <server>
        <id>nexushost.yyc.cn</id><!--与Repository ID一致-->
        <username>yyc</username>
        <password>http://maven.apache.org/guides/mini/guide-encryption.html{Wuf+cyCZLasdfTWsadfy9n12WySuqTdjwoWLr5NYBKY=}</password>
      </server>
  </servers>
```

为私库配置用户名yyc和[加密的密码](http://maven.apache.org/guides/mini/guide-encryption.html)，对应的server.id应该和profile中的Repository ID或者mirror中的ID一致，这样我们的仓库和认证才能对应起来。

另外，

1.私库如果有自签https证书，需要在对应的jdk中导入证书

2.使用mvn deploy命令上传依赖包到私库中时，通常要指定一个repositoryId，这个repositoryId=server.id=配置的仓库Id

# 批量上传本地仓库到私库

写了一个脚本：[maven私库nexus批量上传jar工具-OS文档类资源-CSDN文库](https://download.csdn.net/download/qq_36323797/86405234)



*以上内容收集自百度，经自己经验验证后总结。*