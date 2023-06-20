---
title: 在Spring项目简单配置Flyway(V4.2版本)数据库版本管理
date: 2020-10-23 15:20:08
tag:
  - Flyway
  - 数据库
  - 版本管理
category: 数据库技术
---

## 前言

看了一下[Flyway官网对java支持的介绍](https://flywaydb.org/documentation/v6/api/#supported-java-versions)，发现目前官方版本flayway7.0.4最低只支持Java 7版本，现项目中使用Java 6、Spring4，所以配置4.2.0版本。

## 加入依赖

```xml
<dependency>
	<groupId>org.flywaydb</groupId>
	<artifactId>flyway-core</artifactId>
	<version>4.2.0</version>
</dependency>
```

## 写配置类

```java
import org.flywaydb.core.Flyway;
import javax.sql.DataSource;

public class FlywayConfig {
    private DataSource dataSource;

    public void setDataSource(DataSource dataSource) {
        this.dataSource = dataSource;
    }

    public void migrateInit() {
        //初始化flyway类
        Flyway flyway = new Flyway();
        //如果是新的项目，则无需配置此项
        flyway.setBaselineOnMigrate(true);
        //设置加载数据库的相关配置信息
        flyway.setDataSource(dataSource);
        //设置存放flyway metadata数据的表名，默认"schema_version"，可不写
        flyway.setTable("TABLE_FLYWAY");
        //设置flyway扫描sql升级脚本、java升级脚本的目录路径或包路径，默认"db/migration"，可不写
        flyway.setLocations("flyway/sql");
        //设置sql脚本文件的编码，默认"UTF-8"，可不写
        flyway.setEncoding("GBK");
        //如果是已执行过的项目，则需执行sql文件的基本版本
        flyway.setBaselineVersionAsString("1.0");
        //sql文件的前缀
        flyway.setSqlMigrationPrefix("V-");
        //sql文件的后缀
        flyway.setSqlMigrationSuffix(".sql");
        flyway.migrate();
    }
}
```

## 加入Spring管理

```xml
	<bean id="flywayMigration" class="com.yyc.config.FlywayConfig" init-method="migrateInit">
        <!--数据源-->
		<property name="dataSource" ref="dataSource"></property>
	</bean>
```



将SQL放到配置的resources路径（flyway/sql）下即可。更多规则和详细信息请访问[Flyway官方文档](https://flywaydb.org/documentation/)。

## *拓展*

1. 更多规则和详细信息请访问[Flyway官方文档](https://flywaydb.org/documentation/)
2. 在SpringBoot中配置请访问[Flyway 插件-SpringBoot](https://flywaydb.org/documentation/usage/plugins/springboot)
3. SpringBoot版本Flyway实践代码下载<a :href="$withBase('/code/spring-boot-flyway.zip')" download="spring-boot-flyway.zip">点击下载</a>，SpringBoot版本liquibase实践代码下载<a :href="$withBase('/code/spring-boot-liquibase.zip')" download="spring-boot-liquibase.zip">点击下载</a>