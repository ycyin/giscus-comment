---
title: 解决Spring单元测试中因外键关联导致的失败integrity constraint violation &#58; foreign key no action
tags:
  - spring
  - 单元测试
  - junit
keywords:
  - junit
  - 外键关联
  - integrity constraint violation
  - hsql
date: 2020-09-08 10:03:43
categories: Junit
description: Spring单元测试中因外键关联导致的失败,每个用例单独运行都没有问题，可是一起运行，就出现下面的异常错误信息：integrity constraint violation&#58; foreign key no action。这是由于外键级联导致的问题,解决方法可以编写一个类，继承AbstractTestExecutionListener，在beforeTestClass中取消级联依赖。
---
## 前言

Spring单元测试中因外键关联导致的失败，每个用例单独运行都没有问题，可是一起运行，就出现下面的异常错误信息：integrity constraint violation: foreign key no action。

**出现错误时使用的环境**

- spring：3.2.16.RELEASE
- unitils：3.4.2 （unitils-core、unitils-spring、unitils-dbunit、unitils-inject）
- hsqldb：2.3.2
- hibernate3：3.6.5.Final

单元测试类继承`UnitilsJUnit4`，以使用[unitils](https://baike.baidu.com/item/Unitils)进行测试。查看UnitilsJUnit4的Runner为`@RunWith(UnitilsJUnit4TestClassRunner.class)`

```java
@ContextConfiguration( {"classpath*:applicationContext.xml" }) //① 初始化Spring容器
@DataSet("/data.xls")
public class IServiceImplTest extends UnitilsJUnit4{

   @Autowired
   IService service;

   @Test
   public void testMethod() {
      // do something
   }
}
```

当进行单元测试时，<span style="color:red">每个用例单独运行都没有问题，可是一起运行，就出现下面的异常错误信息：`integrity constraint violation: foreign key no action`。</span>详细错误栈见下：

```java
Caused by: org.unitils.core.UnitilsException: Error while executing DataSetLoadStrategy
	at org.unitils.dbunit.datasetloadstrategy.impl.BaseDataSetLoadStrategy.execute(BaseDataSetLoadStrategy.java:48)
	at org.unitils.dbunit.DbUnitModule.insertDataSet(DbUnitModule.java:342)
	at org.unitils.dbunit.DbUnitModule.insertDataSet(DbUnitModule.java:268)
	at org.unitils.dbunit.DbUnitModule.insertDataSet(DbUnitModule.java:187)
	... 17 more
Caused by: java.sql.BatchUpdateException: integrity constraint violation: foreign key no action; FKD5D67893BB8A6726 table: T_TEST_TABLENAME
	at org.hsqldb.jdbc.JDBCStatement.executeBatch(Unknown Source)
	at org.apache.commons.dbcp.DelegatingStatement.executeBatch(DelegatingStatement.java:297)
	at org.dbunit.database.statement.BatchStatement.executeBatch(BatchStatement.java:59)
	at org.dbunit.operation.DeleteAllOperation.execute(DeleteAllOperation.java:126)
	at org.dbunit.operation.CompositeOperation.execute(CompositeOperation.java:79)
	at org.unitils.dbunit.datasetloadstrategy.impl.CleanInsertLoadStrategy.doExecute(CleanInsertLoadStrategy.java:45)
	at org.unitils.dbunit.datasetloadstrategy.impl.BaseDataSetLoadStrategy.execute(BaseDataSetLoadStrategy.java:44)
	... 20 more

```

## 问题解决

很明显，这是由于批量更新时外键级联导致的问题，解决思路主要是要在执行单元测试前取消级联依赖，其实根据[hsql官方文档](http://hsqldb.org/doc/2.0/guide/index.html)这个级联依赖应该默认是`false`，是否是Hibernate将其设为True还有待证实。

1. 编写一个类，继承`AbstractTestExecutionListener`实现自定义Listener，在`beforeTestClass`中取消级联依赖。具体如下：

    ```java
    import org.dbunit.database.DatabaseDataSourceConnection;
    import org.dbunit.database.IDatabaseConnection;
    import org.springframework.test.context.TestContext;
    import org.springframework.test.context.support.AbstractTestExecutionListener;

    import javax.sql.DataSource;

    public class ForeignKeyDisabling extends AbstractTestExecutionListener {
        @Override
        public void beforeTestClass(TestContext testContext) throws Exception {
            testContext.getApplicationContext()
                    .getAutowireCapableBeanFactory()
                    .autowireBean(this);
            IDatabaseConnection dbConn = new DatabaseDataSourceConnection(
                    testContext.getApplicationContext().getBean(DataSource.class)
            );
            dbConn.getConnection().prepareStatement("SET DATABASE REFERENTIAL INTEGRITY FALSE").execute();

        }
    }
    ```

2. 然后使用`@TestExecutionListeners`注解将这个自定义Listener作用到测试类上。

    <span style="color:red">注意：这里不能使用unitils进行测试了（unitils使用@RunWith(UnitilsJUnit4TestClassRunner.class)），这里需要使用@RunWith(SpringJUnit4ClassRunner.class)</span>

    ```java
    import org.junit.Test;
    import org.junit.runner.RunWith;
    import org.springframework.beans.factory.annotation.Autowired;
    import org.springframework.test.context.ContextConfiguration;
    import org.springframework.test.context.TestExecutionListeners;
    import org.springframework.test.context.junit4.SpringJUnit4ClassRunner;
    import org.springframework.test.context.support.DependencyInjectionTestExecutionListener;
    import org.unitils.dbunit.annotation.DataSet;
    
    import java.util.ArrayList;
    import java.util.List;
    
    import static org.junit.Assert.*;
    
    
    @ContextConfiguration( {"classpath*:applicationContext.xml" }) //① 初始化Spring容器
    @DataSet("/data.xls")
    @RunWith(SpringJUnit4ClassRunner.class) // 不能使用UnitilsJUnit4TestClassRunner
    @TestExecutionListeners(listeners = {
          ForeignKeyDisabling.class, //自定义的Listener
          DependencyInjectionTestExecutionListener.class // Spring自带的对测试类中的依赖进行注入的Listener
    })
    public class IServiceImplTest{
    
       @Autowired
       IService service;
    
       @Test
       public void testMethod() {
          // do something
       }
    }
    ```

再运行单元测试就没有问题了。

## 参考

1. [hsql官方文档-set database sql references statement](http://hsqldb.org/doc/2.0/guide/management-chapt.html#mtc_sql_settings)
2. [spring3.2官方文档-AbstractTestExecutionListener](https://docs.spring.io/spring/docs/3.2.1.RELEASE/javadoc-api/org/springframework/test/context/support/AbstractTestExecutionListener.html)
3. [stackoverflow上的相同问题](https://stackoverflow.com/questions/2685274/tdd-with-hsqldb-removing-foreign-keys)
4. [数据访问层单元测试遇到的问题](https://blog.csdn.net/mydeman/article/details/9374621)
5. [Spring Runwith注解和TestExecutionListener使用解析](https://www.jianshu.com/p/375edd8d2697)