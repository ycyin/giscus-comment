---
title: 在SpringBoot项目配置Liquibase数据库版本管理
date: 2022-02-18 17:44:18
tags:
  - Liquibase
  - 数据库
  - 版本管理
categories: 数据库技术
---

## 前言

此前写过一篇[在Spring项目简单配置Flyway(V4.2版本)数据库版本管理](https://ladybug.top/数据库技术/configuring-flyway-tool-in-spring-project.html)。本次新项目使用SpringBoot3.0.4，尝试采用Liquibase4.5作为数据库版本管理工具。

这里记录使用XML和SQL两种方式，这两种方式使用最普遍，实际使用时选择其一即可。

## 加入依赖

```groovy
//liquibase
implementation 'org.liquibase:liquibase-core:4.5.0'
```

## 写配置类

```java
@Configuration
public class LiquibaseConfig {

    @Bean
    public SpringLiquibase liquibase(DataSource dataSource) {
        SpringLiquibase liquibase = new SpringLiquibase();
        liquibase.setDataSource(dataSource);
        //指定changelog的位置，这里使用的一个master文件引用其他文件的方式
        liquibase.setChangeLog("classpath:liquibase/master.xml");
        liquibase.setDatabaseChangeLogTable("DB_LIQUIBASE_LOG");
        liquibase.setDatabaseChangeLogLockTable("DB_LIQUIBASE_LOGLOCK");
        return liquibase;
    }
}
```

## 创建master.xml

在`resources`下创建`liquibase/master.xml`文件。用于引入其它文件。

```xml
<?xml version="1.0" encoding="UTF-8"?>

<databaseChangeLog
        xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.5.xsd">

    <!--
    1：includeAll 标签可以把一个文件夹下的所有 changelog 都加载进来。如果单个加载可以用 include。
    2：includeAll 标签里有两个属性：path 和 relativeToChangelogFile。
        2.1：path （在 include 标签里是 file）：指定要加载的文件或文件夹位置
        2.2：relativeToChangelogFile ：文件位置的路径是否相对于 root changelog 是相对路径; 默认 false，即相对于 classpath 是相对路径。
    -->

    <includeAll path="liquibase/changelog/" relativeToChangelogFile="false"/>

</databaseChangeLog>
```

## 数据变更日志文件

也就是我们要执行的SQL资源文件，Liquibase支持多种格式，如 XML、SQL、JSON、YAML 等。将资源文件放到配置的resources路径（liquibase/changelog/）下即可。更多规则和详细信息请访问[Changelog Formats | Liquibase Docs](https://docs.liquibase.com/concepts/changelogs/changelog-formats.html)。这里举例XML和SQL两种方式。实际使用时选择其一即可，推荐使用SQL的方式，对开发人员更友好。

### XML

随意取名XML文件。内容按照官方规则编写即可。具体规则可以查看官方文档：[Example Changelogs: XML Format | Liquibase Docs](https://docs.liquibase.com/concepts/changelogs/xml-format.html)、[Liquibase Change Types | Liquibase Docs](https://docs.liquibase.com/change-types/home.html)

```xml
<?xml version="1.0" encoding="UTF-8"?>

<databaseChangeLog
        xmlns="http://www.liquibase.org/xml/ns/dbchangelog"
        xmlns:xsi="http://www.w3.org/2001/XMLSchema-instance"
        xmlns:ext="http://www.liquibase.org/xml/ns/dbchangelog-ext"
        xmlns:pro="http://www.liquibase.org/xml/ns/pro"
        xsi:schemaLocation="http://www.liquibase.org/xml/ns/dbchangelog http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-4.5.xsd
        http://www.liquibase.org/xml/ns/dbchangelog-ext http://www.liquibase.org/xml/ns/dbchangelog/dbchangelog-ext.xsd http://www.liquibase.org/xml/ns/pro http://www.liquibase.org/xml/ns/pro/liquibase-pro-4.5.xsd">
    
    <!-- 每一个changeSet表示一个变更单元，可以配置多个
     id： changeset标识，规则自定义，可以模仿版本号的形式（方便管理），也可以直接用自增序列 1，2，3... 
     author：作者署名  
    -->
    <changeSet author="yinyicao" id="20220218001">
        <!--创建表 remarks:表备注 tableName:表名-->
        <createTable remarks="测试表"
                     tableName="T_TABLE_DB_TEST">
            <column name="ID" type="VARCHAR2(32)" remarks="主键ID" defaultValueComputed="SYS_GUID()">
                <!--添加约束-->
                <constraints primaryKey="true" nullable="false" />
            </column>
            <column name="NAME" type="VARCHAR2(255)" remarks="用户名称">
                <constraints  nullable="false"/>
            </column>
            <column name="DESC1" type="VARCHAR2(255)" remarks="描述"/>
            <column name="STATE" type="VARCHAR2(32)" remarks="状态"/>
            <column name="PRICE" type="NUMBER(*,2)" remarks="金额"/>
        </createTable>
    </changeSet>
</databaseChangeLog>
```

### SQL

随意取名SQL文件。<span style="color:red">内容按照官方规则编写，我第一次使用时就是没有仔细查看官方文档，没有按照格式写SQL文件，直接往里面堆SQL，程序连接H2和MySQL时可以识别，但是程序连接Oracle后Liquibase无法识别分号(;)一直报错：`SQLSyntaxErrorException: ORA-00911: 无效字符`。</span>具体规则可以查看官方文档示例：[Example Changelogs: SQL Format | Liquibase Docs](https://docs.liquibase.com/concepts/changelogs/sql-format.html)

SQL 格式如下：
`--liquibase formatted sql` 必须以这个开头 ，
`--changeset [author]:[id]` 与xml中的`<changeSet>`功能相同，表示一个变更单元，下一行直接写sql脚本，
`--rollback` 可以配置回滚,changset执行失败时可以进行回滚，如果没有直接用 `--rollback not required`

```sql
--liquibase formatted sql

--changeset ycyin:20220218001 dbms:oracle
CREATE TABLE T_TABLE_DB_TEST
(
    ID     VARCHAR2(32) DEFAULT SYS_GUID() NOT NULL
        CONSTRAINT PK_T_TABLE_DB_TEST
        PRIMARY KEY,
    NAME   VARCHAR2(255)                   NOT NULL,
    DESC1 VARCHAR2(255),
    STATE  VARCHAR2(32),
    PRICE  NUMBER
);

COMMENT ON TABLE T_TABLE_DB_TEST IS '测试表';

COMMENT ON COLUMN T_TABLE_DB_TEST.ID IS '主键ID';

COMMENT ON COLUMN T_TABLE_DB_TEST.NAME IS '用户名称';

COMMENT ON COLUMN T_TABLE_DB_TEST.DESC IS '描述';

COMMENT ON COLUMN T_TABLE_DB_TEST.STATE IS '状态';

COMMENT ON COLUMN T_TABLE_DB_TEST.PRICE IS '金额';
--rollback drop table T_TABLE_DB_TEST;
```

## 使用H2内存数据库测试一下

加入依赖：devtools可以提供h2的图形化操作页面

```groovy
//h2数据库
implementation 'com.h2database:h2'
implementation 'org.springframework.boot:spring-boot-devtools'
```

配置数据库连接：

```yaml
spring:
  datasource:
    driver-class-name: org.h2.Driver
    url: jdbc:h2:mem:ycyin;MODE=Oracle;DB_CLOSE_DELAY=-1;DB_CLOSE_ON_EXIT=FALSE
    username: root
    password:
```

启动项目后访问：`http://localhost:8080/h2-console/login.jsp` 登录即可。

第一次执行Liquibase会在数据库中创建两张表：
`databasechangelog` 用于记录执行的历史脚本
`databasechangeloglock` 锁定操作，防止多处同时执行

## *参考*

1. 更多规则和详细信息请访问[Liquibase Online Documentation](https://docs.liquibase.com/home.html)
3. Flyway可以参考[在Spring项目简单配置Flyway(V4.2版本)数据库版本管理](https://ladybug.top/数据库技术/configuring-flyway-tool-in-spring-project.html)，底部有示例代码可供下载。
3. [liquibase-数据库脚本升级管理_薛定谔的雄猫-CSDN博客](https://blog.csdn.net/iteye_19045/article/details/98885817)
3. [SpringBoot集成H2数据库 - 仅此而已-远方 - 博客园 (cnblogs.com)](https://www.cnblogs.com/xuwenjin/p/14829316.html)
3. [如何查看内存数据库H2中的数据-百度经验 (baidu.com)](https://jingyan.baidu.com/article/0a52e3f4fc53aabf62ed72b5.html)
3. [liquibase集成springboot使用步骤（全网最详细）_TonyWu的博客-CSDN博客_liquibase springboot](https://blog.csdn.net/weixin_41404773/article/details/106355563)
3. [Spring Boot 2 Liquibase 3.8 分模块 ORACLE 下问题_MLstars的专栏-CSDN博客](https://blog.csdn.net/MLstars/article/details/105390332)