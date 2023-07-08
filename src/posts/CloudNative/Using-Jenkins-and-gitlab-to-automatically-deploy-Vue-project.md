---
title: '使用Jenkins+GitLab实现自动部署vue项目'
date: 2021-01-11 16:45:41
tag:
  - Jenkins
  - GitLab
category: 云原生
---

在众多持续集成/持续部署(CI/CD)工具中（如**GitLab CI**、**Travis CI**、**TeamCity**等），有人说[Jenkins已经老了](https://www.jdon.com/52172)，现在也有很多优秀的[Jenkins替代方案](http://www.360doc.com/content/20/1111/12/46368139_945280698.shtml)。本文选择**Jenkins**仅仅是因为它安装简单、部署简单的项目上手快（有Web界面）。

<!-- more -->

使用的Jenkins版本：[Jenkins 2.263.1](https://jenkins.io/)，部署机器：CentOS 7

使用Jenkins+gitlab实现自动部署vue项目基本思路：gitlab每次提交代码使用 GitLab 的 WebHook 来触发 Jenkins 构建，Jenkins执行shell脚本打包Vue项目，然后将打包后的静态文件复制到nginx指定的html目录中。

## 安装环境

### 安装JDK

> Jenkins基于Java开发，所以需要Java运行环境。

[官网](http://www.oracle.com/technetwork/java/javase/downloads/jdk8-downloads-2133151.html)选择对应JDK版本下载链接：

下载：

```shell
wget https://download.oracle.com/otn/java/jdk/8u271-b09/61ae65e088624f5aaa0b1d2d801acb16/jdk-8u271-linux-x64.tar.gz?AuthParam=1610086904_2c9dd4492a9232e623d371bcdaaae54f
```

创建安装目录

```shell
mkdir /usr/local/java/
```

解压至安装目录

```shell
tar -zxvf jdk-8u271-linux-x64.tar.gz -C /usr/local/java/
```

设置环境变量：

```shell
vi /etc/profile
```

在末尾添加

```shell
export JAVA_HOME=/usr/local/java/jdk1.8.0_271
export JRE_HOME=${JAVA_HOME}/jre
export CLASSPATH=.:${JAVA_HOME}/lib:${JRE_HOME}/lib
export PATH=${JAVA_HOME}/bin:$PATH
```

使环境变量生效

```shell
source /etc/profile
```

添加软链接

```shell
ln -s /usr/local/java/jdk1.8.0_271/bin/java /usr/bin/java
```

检查

```shell
java -version
```

### 安装Jenkins

> 通过尝试，使用Jenkins不推荐用Docker方式安装，会因为缺少环境而造成不必要的麻烦。
>
> 这里使用下载好的安装包安装，yum方式参见[官网](https://jenkins.io/download/)，比较慢
**下载rpm包并安装**

官方镜像：https://pkg.jenkins.io/

推荐 清华镜像站：https://mirrors.tuna.tsinghua.edu.cn/jenkins/（速度快）

中国科学技术大学镜像站：https://mirrors.ustc.edu.cn/jenkins/

```shell
#下载
wget https://mirrors.tuna.tsinghua.edu.cn/jenkins/redhat-stable/jenkins-2.263.1-1.1.noarch.rpm
#安装
rpm -ivh jenkins-2.263.1-1.1.noarch.rpm
```

**网络联通配置**

1.如果安装Jenkins的机器启动了安全组策略，需要开放修改后的端口，如下：

```shell
firewall-cmd --zone=public --add-port=8080/tcp --permanent #添加TCP端口
firewall-cmd --reload
```

2.因为后面GitLab需要配合Jenkins以实现提交代码就完成自动部署，所以如果有需要，则要添加GitLab服务器的IP，使得GitLab服务器可以访问Jenkins服务器。

```shell
firewall-cmd --permanent --zone=trusted --add-source=172.26.1.15 #添加IP
firewall-cmd --reload
firewall-cmd --zone=trusted --list-all
```

3.因为后面Jenkins要去拉取gitlab的代码，所以需要生成ssh密钥

```shell
ssh-keygen -t rsa -b 4096 -C "your_email@example.com"
```

将公钥添加到gitlab：来到gitlab个人中心，点设置，左边点SSH密钥，右边填入id_rsa.pub里面的字符，然后点添加密钥即可。

**Jenkins配置**

1. Jenkins默认端口为8080， 有冲突的自行修改

   ```shell
   vi  /etc/sysconfig/jenkins
   #例 修改为
   JENKINS_PORT="8080"
   ```

2. 配置JDK路径，JDK安装目录是自定义的，需要添加

   ```shell
   vi /etc/init.d/jenkins
   #加上自己的jdk路径
   ```

   我这里添加过软链接到/usr/bin/java，所以不用再添加了。

   ![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210111112847.png)

3. 启动

   ```shell
   systemctl start jenkins
   ```
   
4. 访问
通过IP:Port即可访问Jenkin页面，通过提示找到密码登录。
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210108100916.png)
插件安装选择安装推荐的插件即可。可能安装失败，重试或者继续暂时忽略失败的插件安装。
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210108101321.png)
等待片刻（其实要很久），就安装完成了。

### 安装插件

【系统管理-->插件管理】可以在线安装需要的插件，但是安装比较慢，还经常失败，推荐设置升级站点或上传插件离线安装。

本文章需要编译Vue项目，所以需要单独安装一个NodeJS插件。

**设置升级站点**
【系统管理-->插件管理-->高级-->升级站点】

替换升级站点URL，这里推荐两个地址可用：

```
http://mirror.esuni.jp/jenkins/updates/update-center.json
```

或

```shell
https://mirrors.tuna.tsinghua.edu.cn/jenkins/updates/update-center.json
```

其它的Jenkins的镜像地址可以查询：http://mirrors.jenkins-ci.org/status.html

保存后，即可返回到【可选插件】选项卡下，进行搜索重新安装。

**离线安装**

可以通过上面提供的国内镜像地址下载好插件，如：https://mirrors.tuna.tsinghua.edu.cn/jenkins/plugins/ 然后通过【系统管理-->插件管理-->高级-->上传插件】来离线安装

### 安装NodeJS

本文章需要编译前端的Vue项目，上面安装好了插件，现在还需要本机安装好NodeJS。

（1）去nodejs官网下载最新包

> 官网下载地址:https://nodejs.org/dist/latest/

```shell
wget https://nodejs.org/dist/latest/node-v12.18.3-linux-x64.tar.gz
```

（2）解压安装

```shell
tar xvzf node-v12.18.3-linux-x64.tar.gz -C /opt
```

（3）修改环境变量

```shell
vim /etc/profile
export PATH=/opt/node-v12.18.3-linux-x64/bin:$PATH
```

（4）刷新环境变量，使其生效

```shell
source /etc/profile
```

（5） 安装cnpm与配置淘宝镜像

```shell
npm install -g cnpm --registry=[https://registry.npm.taobao.org](https://registry.npm.taobao.org/)
```

（6） 查看npm,cnpm,node版本号

```shell
node -v
cnpm -v
```

### 配置NodeJS

> Jenkins中配置node

【系统配置-->全局工具配置-->NodeJS】配置安装好的node路径。

![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210111173002.png)

## Jenkins任务

### 构建任务
现在可以新建一个【构建任务】了。点击新建任务，输入任务名称，选择构建一个自由风格的软件项目，点击确定进入下一步。

![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210111172623.png)

### 源码管理
选择【源码管理】，输入仓库地址，会提示连接不上，这时候前面生成的ssh-key就派上用场了。点击添加按钮,

![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210108114254.png)

如图所示添加凭据，将之前生成的私钥添加到Key中，点击添加后即可在上一步的Credentials后面的下拉框中选择刚刚添加的凭据。
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210108114105.png)

选择后就不报错了，说明可以访问到gitlab仓库了。
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210108114306.png)

### 构建触发器
选择【构建触发器】，选中【触发远程构建】，输入一个身份验证令牌，后面要用。[](#build-triggers)
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210111175017.png)

### 构建环境
选择【构建环境】，选择【Provide Node & npm bin/ folder to PATH】，然后选择我们配置好的Node环境。
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210111175434.png)

### 构建
选择【构建】，【增加构建步骤】选择【执行Shell】,然后填入构建时对应需要执行的shell脚本。

```shell
source /etc/profile #声明环境变量
cnpm cache verify #清除缓存
cnpm install #安装
npm run build #编译
#拷贝dist下所有文件到nginx对应目录下
cp -Rf /var/lib/jenkins/workspace/bde-data/dist/*  /usr/local/nginx/html/bde/ 
```
如下图：
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210111175526.png)

### 构建后操作
可以配置邮件通知等操作，这里就不配了。

## 配置WebHook

### 获取账户token

登录有效账户，【用户列表-->点击用户ID-->设置-->API Token-->添加新Token】点击生成，即可生成一个Token
![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210112111042.png)

### 获取项目Token

之前<a href="#build-triggers">构建触发器</a>时输入的身份验证令牌就是项目Token，可以去项目任务配置那获取或重新配置。

### 生成触发器URL
之前<a href="#build-triggers">构建触发器</a>时那里有提示URL的格式。

JENKINS_URL/job/bde-data/build?token=TOKEN_NAME 或者 /buildWithParameters?token=TOKEN_NAME
Optionally append &cause=Cause+Text to provide text that will be included in the recorded build cause.

然后在需要gitlab项目的 WebHook【settings-->integrations】中填写该 URL（Trigger选择Push events代表Push代码时触发），在 host 前面加上 `[账户名]:[账户Token]@`，完整格式为：`https://myid:mytoken@myjenkins.com/job/myJobName/build?token=my_job_token`。比如我这里就是：

**`http://admin:11af75c3dd68048c06aaaf77e0f9a15339@172.26.11.160:8080/job/bde-data/build?token=ycyin20210108`**


## 部署测试

此时，提交一次代码，gitlab触发Jenkins构建。

gitlab点击编辑对应的Webhook可以看到成功：

![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210112114114.png)

Jenkins可以看到构建状态、控制台输出等：

![](./Using-Jenkins-and-gitlab-to-automatically-deploy-Vue-project/20210112114154.png)

本文参考：

1. https://www.cnblogs.com/fangts/p/11095316.html
2. https://blog.csdn.net/codebingo/article/details/112126788
3. https://blog.51cto.com/13760351/2382464
4. https://zhuanlan.zhihu.com/p/201307678
5. https://blog.csdn.net/chengyinwu/article/details/103056605
6. https://www.cnblogs.com/sxdcgaq8080/p/10489326.html
7. https://www.colabug.com/2018/0801/3851860/