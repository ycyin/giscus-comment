---
title: 解决前后端分离项目中Vue不带cookies的问题
date: 2020-03-11 16:29:08
tag:
  - Vue
  - Cookies
category: 前端技术
---

## 问题重现

在前后端分离项目中，后端使用Shiro做权限管理，前端使用Vue展示，在使用axios进行数据交换时，axios不带cookie，导致前台登录成功后无法发送第二次请求（Session失效），要求用户进行再次登录。

<!--more-->

我们知道后台的session需要前后端共同维持，前端每次请求都要开启Cookie发送JSESSIONID给后端，后端才能够确认本次请求是否与上一次请求会话相同。

axios默认不开启Cookie，导致每次请求会话过期。

## 问题解决

1、设置axios请求带上Cookies

```js
axios.defaults.withCredentials = true
```

2、在前端，保存并维护好用户信息

（1）将要使用到的一些用户信息保存在前端（localStorage或者sessionStorage）

```javascript
sessionStorage.setItem('userinfo', JSON.stringify(obj))
```

（2）并且要在`Vuex.Store`维护这些信息

```javascript
const store = new Vuex.Store({
  state: {
    locaScreen: true,
    timeRecords: [],
    opened: true,
    device: 'desktop',
    visitedViews: []
  },
  getters: {
    getStorage(state) {
      console.log("getStorage--->has state.userinfo:"+!state.userinfo)
      if (!state.userinfo) {
        state.userinfo = JSON.parse(sessionStorage.getItem('userinfo'))
      }
      return state.userinfo
    }
  }
})
```

（3）在`App.vue`中调用`getStorage`方法，防止页面刷新时，数据丢失。

```javascript
export default {
   name: 'App',
   mounted () {
     console.log("mounted method is running in App.vue file.")
     this.$store.getters.getStorage
   }
}
```





此时，问题解决。