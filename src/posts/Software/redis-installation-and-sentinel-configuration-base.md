---
title: Redis安装与哨兵模式配置入门
tag:
  - redis
  - 缓存
keywords:
  - reids安装
  - 哨兵模式
date: 2020-08-27 13:52:26
category: 软件安装&配置
description: 在多台机器上安装和配置Redis，并启用Sentinel模式。在三台机器上安装Redis（一个主，两个从），并启动三个哨兵（多哨兵模式可以有效地防止单哨兵不可用的情况）。本文主要记录如何安装Redis,如何配置redis.conf和sentinel.conf文件
---
## 前言

**目标**：在三台机器上安装Redis（一个主，两个从），并启动三个哨兵（多哨兵模式可以有效地防止单哨兵不可用的情况）。

**环境清单**

- CentOS Linux 7 (Core)
  Kernel 3.10.0-1127.el7.x86_64 on an x86_64
- Redis 5.0.3

**服务分配清单**

| 服务进程类型 | 是否Redis主服务器 | IP地址       | 服务端口号 |
| ------------ | ----------------- | ------------ | ---------- |
| Redis        | 是                | 172.26.11.89 | 6379       |
| Redis        | 否                | 172.26.11.90 | 6379       |
| Redis        | 否                | 172.26.11.91 | 6379       |
| Sentinel     | —                 | 172.26.11.89 | 26379      |
| Sentinel     | —                 | 172.26.11.90 | 26379      |
| Sentinel     | —                 | 172.26.11.91 | 26379      |

注意：如果安装后需要在本地测试，不要忘记关闭防火墙或者开放服务端口。

## 安装Redis

### 下载

redis官网地址：http://www.redis.io/

下载地址：http://download.redis.io/releases/

redis中文文档地址：http://www.redis.cn/documentation.html

使用命令下载：

```shell
wget http://download.redis.io/releases/redis-5.0.3.tar.gz
```

如果linux中没有wget命令，就用如下命令安装（在根目录下执行）：

```shell
yum -y install wget
```

### 安装

1、解压下载完成的源码（我这里下载到/home/centos目录下），编译。

```shell
[root@localhost centos]# tar xzf redis-5.0.3.tar.gz
[root@localhost centos]# cd /home/centos/redis-5.0.3
[root@localhost redis-5.0.3]# make
```

2、如果没有安装gcc，需要安装。

```shell
[root@localhost redis-5.0.3]# yum -y install gcc
```

验证是否安装成功

```shell
[root@localhost redis-5.0.3]# rpm -qa|grep gcc
gcc-4.8.5-39.el7.x86_64
libgcc-4.8.5-39.el7.x86_64
```

3、继续执行make命令编译源码。

```shell
[root@localhost redis-5.0.3]# make
```

可能出现错误：<span style='color:red'>致命错误:jemalloc/jemalloc.h:没有那个文件或目录</span>

原来redis在内存分配上默认用的是jemalloc,jemalloc是管理内存碎片的

有兴趣的可以参考下这个博客：https://blog.csdn.net/xiaofei_hah0000/article/details/52214592

我们测试的话用这个

执行命令：make MALLOC=libc

```shell
[root@localhost redis-5.0.3]# make MALLOC=libc
```

当出现`Hint:It's a good idea to run 'make test'`是代表make成功。

4、执行make install命令安装

```shell
[root@localhost redis-5.0.3]# cd src/
[root@localhost src]# make install PREFIX=/usr/local/redis
```

我们可以增加PREFIX参数，这样可以将其安装到指定的目录中（/usr/local/redis）。

5、执行make test

```shell
[root@localhost src]# make test
```

提示需要安装tcl，这里直接使用yum安装

```shell
[root@localhost src]# yum -y install tcl
```

再次执行make test，等待完成`All test passed without errors!`安装完成。

## 配置主从和哨兵

1、复制配置文件

复制下载目录（/home/centos/redis-5.0.3）下的redis.conf和sentinel.conf文件到我们的安装目录(/usr/local/redis)的bin目录下：

- redis.conf：redis的配置文件
- sentinel.conf：redis哨兵模式启动的配置文件

```shell
cp /home/centos/redis/redis-5.0.3/redis.conf     /usr/local/redis/bin
cp /home/centos/redis/redis-5.0.3/sentinel.conf  /usr/local/redis/bin
```

2、配置redis.conf

主服务器：172.26.11.89:6379

```shell
vi /usr/local/redis/bin/redis.conf 
#查找daemonize no改为 yes以守护进程方式运行 即以后台运行方式去启动
daemonize yes 
#修改dir ./为绝对路径, 默认的话redis-server启动时会在当前目录生成或读取dump.rdb 所以如果在根目录下执行redis-server /etc/redis.conf的话#, 读取的是根目录下的dump.rdb,为了使redis-server可在任意目录下执行 所以此处将dir改为绝对路径 
dir /usr/local/redis-5.0.3/bin
#修改appendonly为yes 
#指定是否在每次更新操作后进行日志记录， Redis在默认情况下是异步的把数据写入磁盘， 
#如果不开启，可能会在断电时导致一段时间内的数据丢失。 因为 redis本身同步数据文件是按上面save条件来同步的， 
#所以有的数据会在一段时间内只存在于内存中。默认为no 
appendonly yes 
#redis 日志生成位置(可能需要手动创建一下这个文件)
logfile "/app/log/redis.log"
# 禁用保护模式(测试时为了方便，直接关闭)
# redis3.2版本后新增protected-mode配置，默认是yes，即开启。设置外部网络连接redis服务，设置方式如下：
# 1、关闭protected-mode模式，此时外部网络可以直接访问
# 2、开启protected-mode保护模式，需配置bind ip或者设置访问密码
protected-mode no
# 修改可以访问的IP(为了方便，直接设置为0.0.0.0代表可以任意IP跨域访问)
bind 0.0.0.0
# 设置Redis服务密码
requirepass 123456
```

从服务器：172.26.11.90:6379和172.26.11.91:6379

其它配置和主服务器一样，增加两个配置项：

```shell
# 配置从哪里复制数据（也就是配置主服务器）
replicaof 172.26.11.89 6379
# 配置主Redis服务器密码(也就是主服务器的requirepass)
masterauth 123456
```

<span style="color:green">此时已经完成了Redis服务器的主从配置，我们还需要配置哨兵。</span>>

3、配置sentinel.conf

三个哨兵服务的配置均作如下修改：

```shell
# 查找daemonize no改为 yes以守护进程方式运行 即以后台运行方式去启动
# 第一次测试的时候可以先不开，以便可以直接观察主从和哨兵模式的相关信息
daemonize yes 

# 禁用保护模式(测试时为了方便，直接关闭)
protected-mode no

# 配置监听的主服务器，这里sentinel monitor 代表监控，
# mymaster 代表服务器名称，可以自定义
# 172.26.11.89 6379代表监控的主服务器IP和端口
# 2 代表只有在2个或者2个以上的哨兵认为主服务器不可用的时候，才进行客观下线
sentinel monitor mymaster 172.26.11.89 6379 2

# sentinel auth-pass 定义服务的密码
# mymaster 服务名称
# 123456 Redis服务器密码
sentinel auth-pass mymaster 123456
```

## 启动和测试

进入Redis安装目录启动，<span style='color:red'>需要注意启动顺序，首先是主Redis服务器，然后是从Redis服务器，最后才是3个哨兵。</span>启动之后，观察最后一个启动的哨兵，可以看到主从服务器和哨兵的相关信息，说们我们的多哨兵配置正确，搭建完成。

```shell
# 启动Redis 服务
[root@localhost /]# cd ./usr/local/redis/bin
[root@localhost bin]# ./redis-server redis.conf 

# 启动哨兵进程服务
[root@localhost bin]# ./redis-sentinel sentinel.conf
```

可以在主服务器上启动一个客户端进行测试，也可以在本地上安装一个`Another Redis Desktop Manager`测试。

```shell
[root@localhost bin]# ./redis-cli 
127.0.0.1:6379> auth 123456
OK
127.0.0.1:6379> set key3 value3
OK
127.0.0.1:6379> get key3
"value3"
127.0.0.1:6379> exit
```

使用命令`ps aux | grep redis` 查看是否启动成功正在运行。

```shell
[root@localhost bin]# ps aux | grep redis
root      2289  0.0  0.0 112808   964 ttyS0    S+   10:55   0:00 grep --color=auto redis
root     14508  0.1  0.0 145384  3528 ?        Ssl  Aug25   3:14 ./redis-server 0.0.0.0:6379
root     14720  0.1  0.0 144240  2220 ?        Ssl  Aug25   4:11 ./redis-sentinel *:26379 [sentinel]
```

## 停止与关闭

停止redis-server，`./redis-cli -a 密码 shutdown`

```shell
./redis-cli -a 123456 shutdown
```

也可以直接`kill -9 PID`杀掉进程。

## 本地无法连接

本地代码中或者RedisDesktopManager等其它工具无法连接redis解决:

1.查看redis.conf配置文件: 设置protected-mode为 no

- 关闭protected-mode模式，此时外部网络可以直接访问

- 开启protected-mode保护模式，需配置bind ip或者设置访问密码

2.开放服务器端口: 管理防火墙/开发端口，如果是云服务器需要配置安全组规则。



## 参考

1. 《Spring Cloud 微服务和分布式系统实践》，杨开振著

2.  [Linux中Redis的安装](https://www.cnblogs.com/xyinjie/p/9444280.html)

3.  [Linux redis sentinel 哨兵开机启动](https://www.jianshu.com/p/cc0b2e708b63)