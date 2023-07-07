---
title: SSM集成Shiro不进入自定义Realm的doGetAuthorizationInfo的解决方案
date: 2020-02-10 11:10:14
tag:
  - SSM
  - Shiro
category: Web技术&安全
---

## 问题重现

在使用SSM(Spring+SpringMVC+Mybatis)中集成Shiro时，主要使用xml进行配置。一般地，我们就需要自定义Realm，继承AuthorizingRealm重写`doGetAuthorizationInfo`（权限配置）和`doGetAuthenticationInfo`（身份验证）方法，和SSM集成时无法进入`doGetAuthorizationInfo`方法，配置的用户角色权限不生效，导致每一个用户都有访问所有方法。
<!--more-->
自定义的Realm类：

```java
import com.yyc.dao.ISysPermissionMapper;
import com.yyc.dao.ISysRoleMapper;
import com.yyc.entity.UserInfo;
import com.yyc.service.UserService;
import org.apache.shiro.authc.AuthenticationException;
import org.apache.shiro.authc.AuthenticationInfo;
import org.apache.shiro.authc.AuthenticationToken;
import org.apache.shiro.authc.SimpleAuthenticationInfo;
import org.apache.shiro.authc.UnknownAccountException;
import org.apache.shiro.authc.UsernamePasswordToken;
import org.apache.shiro.authz.AuthorizationInfo;
import org.apache.shiro.authz.SimpleAuthorizationInfo;
import org.apache.shiro.realm.AuthorizingRealm;
import org.apache.shiro.subject.PrincipalCollection;
import org.apache.shiro.util.ByteSource;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Autowired;


public class MyShiroRealm extends AuthorizingRealm {
	
	private final static Logger log = LoggerFactory.getLogger(MyShiroRealm.class);
	
    @Autowired
    UserService userService;
    @Autowired
    ISysRoleMapper sysRoleMapper;
    @Autowired
    ISysPermissionMapper sysPermissionMapper;
    @Override
    protected AuthorizationInfo doGetAuthorizationInfo(PrincipalCollection principal) {
        log.info("开始权限配置-->MyShiroRealm.doGetAuthorizationInfo()");
        SimpleAuthorizationInfo authorizationInfo = new SimpleAuthorizationInfo();
        UserInfo userInfo  = (UserInfo)principal.getPrimaryPrincipal();
        sysRoleMapper.findRoleByUsername(userInfo.getUsername()).stream().forEach(
                sysRole -> {
                    authorizationInfo.addRole(sysRole.getRole());
                    sysPermissionMapper.findPermissionByRoleId(sysRole.getId()).stream().forEach(
                            sysPermission -> {
                                authorizationInfo.addStringPermission(sysPermission.getPermission());
                            }
                    );
                }
        );
        
		log.info("当前登录用户" + userInfo.getUsername() + "具有的角色:" + authorizationInfo.getRoles());
		log.info("当前登录用户" + userInfo.getUsername() + "具有的权限：" + authorizationInfo.getStringPermissions());
        
        return authorizationInfo;
    }

    @Override
    protected AuthenticationInfo doGetAuthenticationInfo(AuthenticationToken token) throws AuthenticationException {
    	log.info("开始验证身份-->method:doGetAuthenticationInfo");
    	// 将token转换成UsernamePasswordToken
    	UsernamePasswordToken upToken = (UsernamePasswordToken) token;
    	// 从转换后的token中获取登录名
    	String username = upToken.getUsername();
        //通过username从数据库中查找 User对象，如果找到，没找到.
        //实际项目中，这里可以根据实际情况做缓存，如果不做，Shiro自己也是有时间间隔机制，2分钟内不会重复执行该方法
        UserInfo userInfo = userService.findByUsername(username);
        System.out.println("----->>userInfo="+userInfo);
        if(userInfo == null){
            throw new UnknownAccountException();// 用户不存在
        }
        
        ByteSource salt = ByteSource.Util.bytes(userInfo.getCredentialsSalt());
        
        SimpleAuthenticationInfo authenticationInfo = new SimpleAuthenticationInfo(
                userInfo, //用户
                userInfo.getPassword(), //密码
                salt,//salt=username+salt
                getName()  //realm name
        );
        return authenticationInfo;
    }
}
```

## 解决问题

解决这个问题前先要知道`doGetAuthorizationInfo`和`doGetAuthenticationInfo`在何时触发。

> 借鉴原文： https://www.cnblogs.com/shun-gege/p/7274875.html 

### 认证流程（会调用`doGetAuthenticationInfo`方法）

登录认证，首先由前端页面发出请求，controller获取到前端提交的用户名和密码，生成令牌，然后调用subject.login(token)方法，此方法会先调用realm中的doGetAuthenticationInfo方法进行认证。认证成功跳转到配置文件中配置的跳转页面 。

> 也就是说，在用户登录的时候就会调用认证方法

### 授权流程（会调用`doGetAuthorizationInfo`方法）

用户授权，会调用realm中的doGetAuthorizationInfo方法。调用此方法的方式有三种：　　　

1、subject.hasRole(“admin”) 或 subject.isPermitted(“admin”)：自己去调用这个是否有什么角色或者是否有什么权限的时候；

2、@RequiresRoles("admin")、@RequiresPermissions("getBookCategoryData") 等：在方法上加注解的时候；

3、[shiro：hasPermission name = "admin"] ：在页面上加shiro标签的时候，即进这个页面的时候扫描到有这个标签的时候。如果在页面上使用shiro标签，必须在头部加上<%@taglib prefix="shiro" uri="http://shiro.apache.org/tags" %>

> 也就是说，当使用了上面三种情况之一的，系统用到授权时才会去调用授权方法

### 与SSM集成时不进入授权流程的问题解决

当我用上面的第二种方式，也就是注解的方式在Controller层进行指定方法权限时，不进入授权流程。最主要的问题就是，需要开启Shiro的注解支持，并且需要Spring AOP的支撑，需要开启Spring AOP。由于SSM使用XML配置，所以需要在shiro.xml中配置以下片段：

```xml
<!-- 保证实现了Shiro内部lifecycle函数的bean执行 -->
<bean id="lifecycleBeanPostProcessor" class="org.apache.shiro.spring.LifecycleBeanPostProcessor"/>
<!-- 开启Shiro注解 巨坑：需要spring aop的支持，在xml中要加入<aop:config proxy-target-class="true"></aop:config> -->
<bean class="org.springframework.aop.framework.autoproxy.DefaultAdvisorAutoProxyCreator" depends-on="lifecycleBeanPostProcessor"/>
<bean class="org.apache.shiro.spring.security.interceptor.AuthorizationAttributeSourceAdvisor">
        <property name="securityManager" ref="securityManager"/>
</bean>
```

在Spring的xml文件中配置以下片段：

```xml
<!--需要aspectj.jar的支持-->
<aop:config proxy-target-class="true"></aop:config>
```

同时在`pom.xml`中加入`aspectj`的jar包：

```xml
<!-- https://mvnrepository.com/artifact/org.aspectj/aspectjweaver -->
<dependency>
   <groupId>org.aspectj</groupId>
   <artifactId>aspectjweaver</artifactId>
   <version>1.9.4</version>
</dependency>
```

或者是直接加入shiro的aop代理包，会自动依赖`aspectj`包：

```xml
<dependency>
   <groupId>org.apache.shiro</groupId>
   <artifactId>shiro-aspectj</artifactId>
   <version>1.3.2</version>
</dependency>
```

特别注意别忘了在`web.xml`中加载所有的xml文件（这里使用的IDE是Idea，文件路径与eclipse等其它工具不同）：

```xml
<context-param>  
    <param-name>contextConfigLocation</param-name>  
    <param-value>
        classpath:spring-mybatis.xml,
        classpath:spring-shiro.xml
     </param-value>
</context-param>  
```

添加完成后，用户进入加有权限注解的方法时便会触发`doGetAuthorizationInfo`方法。