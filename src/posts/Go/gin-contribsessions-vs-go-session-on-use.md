---
title: Go框架gin中的session存储gin-contrib-sessions和go-session
date: 2023-07-26 18:34:12
tag:
  - go-session
  - gin-contribsessions
category: Go
---

在Go语言中使用了gin web框架，<span style="color:red">需要对Go语言Gin框架中进行session管理并且需要将session信息保存到redis</span>，常用的框架有[gorilla/sessions](https://github.com/gorilla/sessions)、[gin-contrib-sessions](https://github.com/gin-contrib/sessions)和[go-session/gin-session](https://github.com/go-session/gin-session)等，本文记录在生产开发中使用的gin-contrib-sessions和go-session代码对比。
## gin初始化

通过`Handler:routes.E`初始化Handler

```go
package apiserver

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/spf13/viper"
	"my.x/apiserver/routes" // 引入routes包执行 ApiHandler 的处理句柄 init函数
)

func Run() {

	var wg sync.WaitGroup

	serverHost := viper.GetString("server.host")
	serverPort := viper.GetString("server.port")
	wg.Add(1)
	go func() {
		log.Println("begin api server")
		defer wg.Done()
		initApiServer(serverHost+":"+serverPort, 5*time.Second, 20*time.Second)
	}()

	wg.Wait()
}


// InitApi 初始化 API
func initApiServer(addr string, readTimeout, writeTimeout time.Duration) {

	var server = &http.Server{
		Addr:         addr,
		Handler:      routes.E, // 使用routes包中的E *gin.Engine
		ReadTimeout:  readTimeout,
		WriteTimeout: writeTimeout,
	}

	err := server.ListenAndServe()
	if err != nil && err != http.ErrServerClosed {
		log.Fatal(err)
	}
}
```
## gin-contrib-sessions

核心代码：

```go
package routes

import (
   "log"
   "strconv"
   "time"

   "github.com/gin-contrib/sessions"
   "github.com/gin-contrib/sessions/redis"
   "github.com/gin-gonic/gin"
   "my.x/pkg/config"
)

var (
   E *gin.Engine

   api   *gin.RouterGroup
)

func GetApiRouter() *gin.RouterGroup {
   return api
}

// ApiHandler 的处理句柄
func init() {

   E = gin.New()
   E.Use(gin.Recovery())

   // 开启session
   s, err := redis.NewStoreWithDB(10, "tcp",
      config.GlobalConfig.Redis.Address, // 使用"github.com/spf13/viper"工具读取的配置文件配置
      config.GlobalConfig.Redis.Password,
      strconv.Itoa(config.GlobalConfig.Redis.Db),
      []byte("secret"))

   if err != nil {
      log.Fatal(err)
   }

   E.Use(sessions.Sessions("sessionId", s))

   api = E.Group("/api")

}
```

工具类：

```go
package util

import (
	"github.com/gin-contrib/sessions"
	"github.com/gin-gonic/gin"
	"log"
)

func GetSession(c *gin.Context, code string) interface{} {
	session := sessions.Default(c)
	return session.Get(code)
}

func SetSession(c *gin.Context, code string, value interface{}) {
	session := sessions.Default(c)
	session.Set(code, value)
}

func SaveSession(c *gin.Context) {
	session := sessions.Default(c)
	err := session.Save()
	if err != nil {
		log.Fatal(err)
	}
}

func RemoveSession(c *gin.Context, code string) {
	session := sessions.Default(c)
	session.Delete(code)
	err := session.Save()
	if err != nil {
		log.Fatal(err)
	}
}

func ClearSession(c *gin.Context) {
	session := sessions.Default(c)
	session.Clear()
	err := session.Save()
	if err != nil {
		log.Fatal(err)
	}
}
```

## go-session

核心代码：

```go
package routes

import (
	"github.com/gin-gonic/gin"
	ginsession "github.com/go-session/gin-session"
	"github.com/go-session/redis"
	"github.com/go-session/session"
	"my.x/pkg/config"
	"time"
)

var (
	E *gin.Engine
	api   *gin.RouterGroup
)

func GetApiRouter() *gin.RouterGroup {
    // 在其它包中的init方法中直接调用这个GetApiRouter方法拿到*gin.RouterGroup用于初始化api
	return api
}


// ApiHandler 的处理句柄
func init() {

	E = gin.New()
	E.Use(gin.Recovery())
	E.Use(ginsession.New(session.SetStore(redis.NewRedisStore(&redis.Options{
		Addr:     config.GlobalConfig.Redis.Address,
		Password: config.GlobalConfig.Redis.Password,
		DB:       config.GlobalConfig.Redis.Db,
		PoolSize: 10,
	})), session.SetExpired(86400)))

	api = E.Group("/api")

}
```

工具类：

```go
package util

import (
	"github.com/gin-gonic/gin"
	ginsession "github.com/go-session/gin-session"
	"log"
)

func GetSession(c *gin.Context, code string) interface{} {
	session := ginsession.FromContext(c)
	res, _ := session.Get(code)
	return res
}

func SetSession(c *gin.Context, code string, value interface{}) {
	session := ginsession.FromContext(c)
	session.Set(code, value)
	err := session.Save()
	if err != nil {
		c.AbortWithError(500, err)
		return
	}
}

func RemoveSession(c *gin.Context, code string) {
	session := ginsession.FromContext(c)
	session.Delete(code)
	err := session.Save()
	if err != nil {
		log.Fatal(err)
	}
}

func ClearSession(c *gin.Context) {
	err := ginsession.Destroy(c)
	if err != nil {
		log.Fatal(err)
	}
}

```

## 总结

可以发现使用gin-contrib-sessions会更简洁特别是需要使用redis存储session信息的时候，但是使用中发现它限制了存储的session大小，超过一定值就会报错：`go SessionStore: the value to store is too big`，后面我改用go-session就没有这个问题。

## 参考

1. https://github.com/gin-contrib/sessions
1. https://github.com/go-session/session
1. https://github.com/go-session/gin-session
1. https://github.com/go-session/redis