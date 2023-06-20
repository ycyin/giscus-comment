---
title: Vue+SSM中使用Token验证登录
date: 2019-12-31 14:31:08
tag:
  - Vue
  - SSM
  - JWT
category: Spring
---

## JWT(JSON Web Token)

前后端分离模式下（跨域），传统的Web验证方式大多数情况使用Session。即每一个用户登录后创建一个Session会话，服务端维持这个Session的状态，在这种模式下的最大缺点是，如果没有分布式架构则无法支持横向扩展，并且当用户量大时，服务器负载量太大。<!--more-->

 面对上述问题，一种灵活的解决方案就是通过客户端保存数据，而服务器根本不保存会话数据，每个请求都被发送回服务器。 JWT是这种解决方案的代表。 当用户与服务器通信时，客户在请求中发回JSON对象（Token）。服务器仅依赖于这个JSON对象来标识用户。为了防止用户篡改数据，服务器将在生成对象时添加签名。服务器不保存任何会话数据，即服务器变为无状态，使其更容易扩展。

## SSM实现

> 这里使用java-jwt这个开源框架管理jwt，更多可查看Github Link: https://github.com/auth0/java-jwt 

在pom.xml加入依赖：

```xml
  <dependency>
     <groupId>com.auth0</groupId>
     <artifactId>java-jwt</artifactId>
     <version>3.4.0</version>
  </dependency>
```

JWTUtils类用于对JSON Web Token的创建、解码和验证，代码见下：

```java
import com.auth0.jwt.JWT;
import com.auth0.jwt.JWTVerifier;
import com.auth0.jwt.algorithms.Algorithm;
import com.auth0.jwt.exceptions.JWTCreationException;
import com.auth0.jwt.exceptions.JWTDecodeException;
import com.auth0.jwt.exceptions.JWTVerificationException;
import com.auth0.jwt.interfaces.DecodedJWT;
import java.util.Date;

public class JWTUtils {

    /**
     * 创建JWT
     * @param expiresTime
     * @param userId
     * @return
     */
    public static String createJWT(long expiresTime,String userId) {

        String token = null;
        try {
            Algorithm algorithm = Algorithm.HMAC256("secret");
            token = JWT.create()
                    .withIssuer(userId) //设置用户
                    .withExpiresAt(new Date(System.currentTimeMillis()+ (expiresTime * 1000))) //设置过期时间
                    .sign(algorithm)
                    ;
        } catch (JWTCreationException exception){
            //Invalid Signing configuration / Couldn't convert Claims.
        }

        return token;
    }

    /**
     * 验证JWT
     * @param token
     * @param userId
     * @return
     */
    public static DecodedJWT verifyJWT(String token,String userId) {
        DecodedJWT jwt = null;
        try {
            Algorithm algorithm = Algorithm.HMAC256("secret");
            JWTVerifier verifier = JWT.require(algorithm)
                    .withIssuer(userId)
                    .acceptExpiresAt(2) //接受过期2秒的token
                    .build(); //Reusable verifier instance
             jwt = verifier.verify(token);
        } catch (JWTVerificationException exception){
            //Invalid signature/claims
        }
        return jwt;
    }

    /**
     * JWT解码
     * @param token
     * @return
     */
    public static DecodedJWT decodedJWT(String token){
        DecodedJWT jwt = null;
        try {
            jwt = JWT.decode(token);
        } catch (JWTDecodeException exception){
            //Invalid token
        }
        return jwt;
    }
}
```

使用时就在用户登录时生成Token，然后将生成的token字符串返回给前端即可。**前端需要将收到的Token存起来，下次请求数据时放到请求Header中发送给后端**

```java
// 生成token 有效时间 600 秒
String token = JWTUtils.createJWT(600,resUser.getUsername().trim());
```

前端将Token字符串发送给后端后，后端使用Filter进行拦截，将Header中的Token进行解码、验证是否正确和有效。代码见下：

```java
import com.alibaba.fastjson.JSONObject;
import com.auth0.jwt.interfaces.DecodedJWT;
import com.yyc.utils.JWTUtils;
import org.springframework.core.annotation.Order;
import javax.servlet.*;
import javax.servlet.annotation.WebFilter;
import javax.servlet.http.HttpServletRequest;
import javax.servlet.http.HttpServletResponse;
import java.io.IOException;
import java.io.PrintWriter;
import java.util.Optional;

/**
 * Token验证过滤器
 */
@Order(4)//设置优先级加载
@WebFilter(urlPatterns = "/*",filterName = "TokenCheckFilter")
public class TokenCheckFilter implements Filter {
 
    /**
     * 初始化
     * @param filterConfig FilterConfig
     * @throws ServletException
     */
    @Override
    public void init(FilterConfig filterConfig) throws ServletException {
    }
 
    /**
     * 过滤
     * @param request
     * @param response
     * @param chain
     * @throws IOException
     * @throws ServletException
     */
    @Override
    public void doFilter(ServletRequest request, ServletResponse response, FilterChain chain) throws IOException, ServletException {
        HttpServletResponse resp = (HttpServletResponse) response;
        HttpServletRequest req = (HttpServletRequest) request;
        String requestURI = req.getRequestURI();
        System.out.println(requestURI);

        String token = Optional.ofNullable(req.getHeader("token")).orElse("NOT FOUNT");
        DecodedJWT jwt = JWTUtils.decodedJWT(token);
        String userId = "";
        if (null != jwt){
             userId = Optional.ofNullable(jwt.getIssuer()).orElse("FAILED");
        }

        DecodedJWT verifyJWT = JWTUtils.verifyJWT(token,userId);

        JSONObject jsonObject = new JSONObject();
        if (verifyJWT == null) { //token无效
            if (requestURI.contains("/login")||requestURI.endsWith("/SSM_war/")){ //登录操作不过滤
                chain.doFilter(req, resp);
            }else{
                PrintWriter writer = resp.getWriter();
                resp.setStatus(401);
                jsonObject.put("isAuthorization",false);
                writer.write(jsonObject.toString());
                return;
            }

        }else{
            chain.doFilter(req, resp);
        }


        System.out.println("to access control check token");
    }
}
```

## 前端处理

> 这里使用的Vue框架，其它框架大同小异。

主要就是要将Token存在前端，这里直接存到Axios请求的Header中，今后每次发送或请求数据时将这个Token发送给后端进行验证。

```javascript
axios.defaults.headers.common['Token'] =  res.data.token;
```

后端处理后，如果Token过期前端如何知道？使用axios的拦截器拦截response响应即可。

```javascript
// http response 拦截器 ,拦截（token过期），重新登录
axios.interceptors.response.use(
  response => {
    return response;
  },
  error => {
    if (error.response) {
      switch (error.response.status) {
        case 401:
          // 返回 401 清除token信息并跳转到登录页面
          Msg.error("身份信息失效，请重新登录！")
          removeToken();
          router.replace('/login');
          break;
        case 500:
          Msg.error("网络错误！")
          break;
        case 404:

          break;
      }
    }
    return Promise.reject(error.response.data)   // 返回接口返回的错误信息
  });
```

