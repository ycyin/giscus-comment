---
title: Docker compose中的MySQL主从复制模式和percona-toolkit工具使用
date: 2023-04-27 18:30:42
tags:
  - Docker
  - MySQL
  - 数据库
  - percona-toolkit
categories: 云原生
description: 介绍在Docker compose中的MySQL主从复制模式和percona-toolkit工具（数据一致性监测、延迟监控）使用
---

## 背景
现需要对docker compose上部署的单机mysql进行备份，我们可以使用[脚本](https://github.com/yinyicao/usefulScript/blob/d24d286ecc62e5c4f78ff3b94801a057eb43848f/shell/backupDB.sh)执行mysqldump命令进行定时备份，但是会存在定时备份时间间隔数据丢失的风险。可以使用主从复制模式来解决这个问题。同时可以使用[percona-toolkit](https://www.percona.com/downloads)工具检查数据一致性。

MySQL：5.7.23

Percona Toolkit：2.2.7[官方文档](https://docs.percona.com/percona-toolkit/)，使用到percona-toolkit工具中三个组件分别是：
  1）pt-table-checksum 负责监测mysql主从数据一致性
  2）pt-table-sync 负责当主从数据不一致时修复数据，让它们保存数据的一致性
  3）pt-heartbeat 负责监控mysql主从同步延迟

## MySQL主从复制搭建

和普通的mysql服务对比只有配置文件上的不同。

### 主master配置文件my.cnf

```bash
[mysqld]
character_set_server = utf8mb4
collation_server = utf8mb4_general_ci
default-time-zone = +08:00
lower_case_table_names = 1
max_allowed_packet = 200M
max_connections = 3000

# [必须]服务器唯一ID，默认是1，一般取IP最后一段
server-id=1

# [必须]启用二进制日志
log-bin=mysql-bin 

# 复制过滤：也就是指定哪个数据库不用同步（mysql库一般不同步）
binlog-ignore-db=mysql

# 设置需要同步的数据库 binlog_do_db = 数据库名； 
# 如果是多个同步库，就以此格式另写几行即可。
# 如果不指明对某个具体库同步，表示同步所有库。除了binlog-ignore-db设置的忽略的库
# binlog_do_db = test #需要同步test数据库。

# 确保binlog日志写入后与硬盘同步
sync_binlog = 1

# 跳过所有的错误，继续执行复制操作
slave-skip-errors = all 
```

> 温馨提示：在主服务器上最重要的二进制日志设置是sync_binlog，这使得mysql在每次提交事务的时候把二进制日志的内容同步到磁盘上，即使服务器崩溃也会把事件写入日志中。 
>
> sync_binlog这个参数是对于MySQL系统来说是至关重要的，他不仅影响到Binlog对MySQL所带来的性能损耗，而且还影响到MySQL中数据的完整性。
>
> 对于``"sync_binlog"``参数的各种设置的说明如下： 
>
> sync_binlog=0，当事务提交之后，MySQL不做fsync之类的磁盘同步指令刷新binlog_cache中的信息到磁盘，而让Filesystem自行决定什么时候来做同步，或者cache满了之后才同步到磁盘。 
>
> sync_binlog=n，当每进行n次事务提交之后，MySQL将进行一次fsync之类的磁盘同步指令来将binlog_cache中的数据强制写入磁盘。   
>
> 在MySQL中系统默认的设置是sync_binlog=0，也就是不做任何强制性的磁盘刷新指令，这时候的性能是最好的，但是风险也是最大的。因为一旦系统Crash，在binlog_cache中的所有binlog信息都会被丢失。而当设置为“1”的时候，是最安全但是性能损耗最大的设置。因为当设置为1的时候，即使系统Crash，也最多丢失binlog_cache中未完成的一个事务，对实际数据没有任何实质性影响。   
>
> 从以往经验和相关测试来看，对于高并发事务的系统来说，“sync_binlog”设置为0和设置为1的系统写入性能差距可能高达5倍甚至更多。

### 从slave配置文件my.cnf

```bash
[mysqld]
character_set_server = utf8mb4
collation_server = utf8mb4_general_ci
default-time-zone = +08:00
lower_case_table_names = 1
max_allowed_packet = 200M
max_connections = 3000

# [必须]服务器唯一ID，默认是1，一般取IP最后一段  
server-id=2

# 如果想实现 主-从（主）-从 这样的链条式结构，需要设置：
# log-slave-updates     只有加上它，从前一台机器上同步过来的数据才能同步到下一台机器。

# 设置需要同步的数据库，主服务器上不限定数据库，在从服务器上限定replicate-do-db = 数据库名；
# 如果不指明同步哪些库，就去掉这行，表示所有库的同步（除了ignore忽略的库）。
# replicate-do-db = test；

# 不同步test数据库 可以写多个例如 binlog-ignore-db = mysql,information_schema 
replicate-ignore-db=mysql  

## 开启二进制日志功能，以备Slave作为其它Slave的Master时使用
log-bin=mysql-bin
log-bin-index=mysql-bin.index

## relay_log配置中继日志
#relay_log=edu-mysql-relay-bin  

## 还可以设置一个log保存周期：
#expire_logs_days=14

# 跳过所有的错误，继续执行复制操作
slave-skip-errors = all
```

### 进入主master进行配置

```bash
docker exec -it mysql-master bash

mysql -uroot -p123456

#查看server_id是否生效
mysql> show variables like '%server_id%';
+----------------+-------+
| Variable_name  | Value |
+----------------+-------+
| server_id      | 1     |
| server_id_bits | 32    |
+----------------+-------+

#看master信息 File 和 Position 从服务上要用
mysql> show master status;
+------------------+----------+--------------+------------------+-------------------+
| File             | Position | Binlog_Do_DB | Binlog_Ignore_DB | Executed_Gtid_Set |
+------------------+----------+--------------+------------------+-------------------+
| mysql-bin.000002 |      154 |              | mysql            |                   |
+------------------+----------+--------------+------------------+-------------------+
1 row in set (0.00 sec)


#开权限
mysql> grant replication slave,replication client on *.* to 'slave'@'%' identified by "123456";
mysql> flush privileges;
```

### 进入从slave进行配置

```bash
docker exec -it mysql-slave bash

mysql -uroot -p123456

#查看server_id是否生效
mysql> show variables like '%server_id%';
+----------------+-------+
| Variable_name  | Value |
+----------------+-------+
| server_id      | 2     |
| server_id_bits | 32    |
+----------------+-------+


# 连接主mysql服务 master_log_file 和 master_log_pos的值要填写主master里查出来的值

change master to master_host='172.27.241.108',master_user='slave',master_password='***',master_port=3036,master_log_file='mysql-bin.000002', master_log_pos=0,master_connect_retry=30;



#启动slave
mysql> start slave;

mysql> show slave status \G;
*************************** 1. row ***************************
               Slave_IO_State: Waiting for master to send event
                  Master_Host: 172.27.241.108
                  Master_User: slave
                  Master_Port: 3306
                Connect_Retry: 30
              Master_Log_File: mysql-bin.000002
          Read_Master_Log_Pos: 617
               Relay_Log_File: tuyjkg8ujj-relay-bin.000001
                Relay_Log_Pos: 783
        Relay_Master_Log_File: mysql-bin.000002
             Slave_IO_Running: Yes
            Slave_SQL_Running: Yes
              Replicate_Do_DB: 
          Replicate_Ignore_DB: 
           Replicate_Do_Table: 
       Replicate_Ignore_Table: 
      Replicate_Wild_Do_Table: 
  Replicate_Wild_Ignore_Table: 
                   Last_Errno: 0
                   Last_Error: 
                 Skip_Counter: 0
          Exec_Master_Log_Pos: 617
              Relay_Log_Space: 997
              Until_Condition: None
               Until_Log_File: 
                Until_Log_Pos: 0
           Master_SSL_Allowed: No
           Master_SSL_CA_File: 
           Master_SSL_CA_Path: 
              Master_SSL_Cert: 
            Master_SSL_Cipher: 
               Master_SSL_Key: 
        Seconds_Behind_Master: 0
Master_SSL_Verify_Server_Cert: No
                Last_IO_Errno: 0
                Last_IO_Error: 
               Last_SQL_Errno: 0
               Last_SQL_Error: 
  Replicate_Ignore_Server_Ids: 
             Master_Server_Id: 1
                  Master_UUID: 8f6e9f5a-61f4-11eb-ac84-0242c0a86002
             Master_Info_File: /var/lib/mysql/master.info
                    SQL_Delay: 0
          SQL_Remaining_Delay: NULL
      Slave_SQL_Running_State: Slave has read all relay log; waiting for more updates
           Master_Retry_Count: 86400
                  Master_Bind: 
      Last_IO_Error_Timestamp: 
     Last_SQL_Error_Timestamp: 
               Master_SSL_Crl: 
           Master_SSL_Crlpath: 
           Retrieved_Gtid_Set: 
            Executed_Gtid_Set: 
                Auto_Position: 0
         Replicate_Rewrite_DB: 
                 Channel_Name: 
           Master_TLS_Version: 
1 row in set (0.01 sec)
```

连接主mysql参数说明：

**master_port**：Master的端口号，指的是容器的端口号

**master_user**：用于数据同步的用户

**master_password**：用于同步的用户的密码

**master_log_file**：指定 Slave 从哪个日志文件开始复制数据，即上文中提到的 File 字段的值

**master_log_pos**：从哪个 Position 开始读，即上文中提到的 Position 字段的值

**master_connect_retry**：如果连接失败，重试的时间间隔，单位是秒，默认是60秒


上面看到，有两个Yes，说明已经成功了

```yaml
        Relay_Master_Log_File: mysql-bin.000002
             Slave_IO_Running: Yes
            Slave_SQL_Running: Yes
```

### 设置从服务器slave为只读模式

在从服务器slave上操作

```sh
SHOW VARIABLES LIKE '%read_only%'; #查看只读状态

SET GLOBAL super_read_only=1; #super权限的用户只读状态 1.只读 0：可写
SET GLOBAL read_only=1; #普通权限用户读状态 1.只读 0：可写
```

到此已经设置成功了，下面就可以测试一下，已经可以主从同步了

从服务器上的常用操作

```sql
stop slave;
start slave;
show slave status;
```

## Percona Toolkit离线安装

下载：<https://www.percona.com/downloads/percona-toolkit/2.2.7/RPM/percona-toolkit-2.2.7-1.noarch.rpm>或者到官网找到toolkit下载：https://www.percona.com/downloads

依赖包：主要是perl和mariadb(mysq)驱动包，直接使用yumdownloader将包及其依赖包一并下载进行安装

```bash
yumdownloader --resolve --destdir /tmp/local-yum/Packages perl-IO-Socket-SSL perl-DBD-MySQL perl-Time-HiRes perl perl-DBI perl-Digest-Perl-MD5 perl-TermReadKey  mariadb
```

<span style="color:red">最开始就是根据网上的教程下载的perl包不全，踩了坑，如果有遇到可以直接把报错到网上(chatgpt好用)搜一下看差哪个依赖包。</span>

## Percona Toolkit使用

> 具体的指令使用就不说了，直接参考官方网站：<https://docs.percona.com/percona-toolkit/> 。也可直接参考文末的文章。
>
> 这里简单记录使用到的命令和遇到的坑。

pt-table-checksum是 Percona-Toolkit的组件之一，用于检测MySQL主、从库的数据是否一致，他会自动侦测并连接到从库，但是我的主库和从库不在同一个网络（不同主机且没有加到同一个Docker Network）下，不能自动侦测，需要指定--recursion-method选项来告诉从库在哪里。

--recursion-method可以有多个选项，我这里使用dsn方式，所以需要手动创建一个表（放到任意一个库都行，只要能连接到）用来存储从库的地址信息。

```sql
CREATE TABLE `dsns` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `parent_id` int(11) DEFAULT NULL,
  `dsn` varchar(255) NOT NULL,
  PRIMARY KEY (`id`)
);
# 插入从库的信息
INSERT INTO dsns (dsn) VALUES ("h=172.27.241.132,u=root,p=****,P=3306");
```

接下来需要分别在主库和从库进行账号授权：（给主库所在的机器的ip授权，授权的用户名和密码可以自行定义，不过要保证这个权限能同时登陆主库和从库）

```sql
# 在主库执行授权
GRANT SELECT, PROCESS, SUPER, REPLICATION SLAVE,CREATE,DELETE,INSERT,UPDATE ON *.* TO 'root'@'172.27.241.108' identified by 'password';

flush privileges;


# 在从库上执行授权
GRANT SELECT, PROCESS, SUPER, REPLICATION SLAVE ON *.* TO 'root'@'172.27.241.108' IDENTIFIED BY 'password';

flush privileges;
```

### pt-table-checksum

现在就可以使用Percona-Toolkit的组件操作了，命令如下：

```bash
# 指定多个库进行检查这些库主、从库的数据是否一致
pt-table-checksum --nocheck-replication-filters --no-check-binlog-format --replicate=huanqiu.checksums --create-replicate-table --databases=agile_service,asgard_service,devops_service,hrds_code_repo,hrds_prod_repo,hzero_admin,hzero_file,hzero_message,hzero_monitor,hzero_platform,knowledgebase_service,test_manager_service,workflow_service h=172.27.241.108,u=root,p=*****,P=3306 --recursion-method="dsn=h=172.27.241.132,u=root,p=*****,P=3306,D=wps,t=dsns"

# 指定某一个库（wps）
pt-table-checksum --nocheck-replication-filters --no-check-binlog-format --replicate=huanqiu.checksums --create-replicate-table --databases=wps h=172.27.241.108,u=root,p=*****,P=3306 --recursion-method="dsn=h=172.27.241.132,u=root,p=*****,P=3306,D=wps,t=dsns"

# 不指定--databases就是所有库
pt-table-checksum --nocheck-replication-filters --no-check-binlog-format --replicate=huanqiu.checksums --create-replicate-table  h=172.27.241.108,u=root,p=*****,P=3306 --recursion-method="dsn=h=172.27.241.132,u=root,p=*****,P=3306,D=wps,t=dsns"
```

>  常用参数解释：
> --nocheck-replication-filters ：不检查复制过滤器，建议启用。后面可以用--databases来指定需要检查的数据库。
> --no-check-binlog-format : 不检查复制的binlog模式，要是binlog模式是ROW，则会报错。
> --replicate-check-only :只显示不同步的信息。
> --replicate= ：指定表存放checksum的信息的表，建议直接写到被检查的数据库当中。
> --databases= ：指定需要被检查的数据库，多个则用逗号隔开。
> --tables= ：指定需要被检查的表，多个用逗号隔开
> h= ：Master的地址
> u= ：用户名
> p=：密码
> P= ：端口

--recursion-method使用`--recursion-method="dsn=h=172.27.241.132,u=root,p=*****,P=3306,D=wps,t=dsns"`就表示去172.27.241.132上的wps库找dsns表查从库信息。

第一次运行的时候需要加上--create-replicate-table参数，生成checksums表！！<span style="color:red">我这里使用--replicate=huanqiu.checksums指定了生成的表名是huanqiu库下的checksums表</span>，如果不加这个参数，那么就需要在对应库下手工添加这张表了,表结构SQL如下

```sql
CREATE` `TABLE` `checksums (
  ``db       ``char``(64)   ``NOT` `NULL``,
  ``tbl      ``char``(64)   ``NOT` `NULL``,
  ``chunk     ``int`     `NOT` `NULL``,
  ``chunk_time   ``float`      `NULL``,
  ``chunk_index  ``varchar``(200)   ``NULL``,
  ``lower_boundary text       ``NULL``,
  ``upper_boundary text       ``NULL``,
  ``this_crc    ``char``(40)   ``NOT` `NULL``,
  ``this_cnt    ``int`     `NOT` `NULL``,
  ``master_crc   ``char``(40)     ``NULL``,
  ``master_cnt   ``int`       `NULL``,
  ``ts       ``timestamp`  `NOT` `NULL``,
  ``PRIMARY` `KEY` `(db, tbl, chunk),
  ``INDEX` `ts_db_tbl (ts, db, tbl)
) ENGINE=InnoDB;
```

检查结果打印如下所示：

```bash
            TS ERRORS  DIFFS     ROWS  CHUNKS SKIPPED    TIME TABLE
01-08T04:11:03      0      0        4       1       0   1.422 wps.haha
```

> **解释：**
> TS ：完成检查的时间。
> ERRORS ：检查时候发生错误和警告的数量。
> DIFFS ：0表示一致，1表示不一致。当指定--no-replicate-check时，会一直为0，当指定--replicate-check-only会显示不同的信息。
> ROWS ：表的行数。
> CHUNKS ：被划分到表中的块的数目。
> SKIPPED ：由于错误或警告或过大，则跳过块的数目。
> TIME ：执行的时间。
> TABLE ：被检查的表名。

### pt-table-sync

```bash
# 检查找到了不一致的数据表，使用工具pt-table-sync进行同步,--print参数是只打印不执行命令
pt-table-sync h=172.27.241.132,u=root,p=*****,P=3306 h=172.27.241.108,u=root,p=*****,P=3306  --databases=agile_service --print
```

> 参数解释：
> --replicate= ：指定通过pt-table-checksum得到的表，这2个工具差不多都会一直用。
> --databases= : 指定执行同步的数据库。
> --tables= ：指定执行同步的表，多个用逗号隔开。
> --sync-to-master ：指定一个DSN，即从的IP，他会通过show processlist或show slave status 去自动的找主。
> h= ：服务器地址，命令里有2个ip，第一次出现的是Master的地址，第2次是Slave的地址。
> u= ：帐号。
> p= ：密码。
> --print ：**打印，但不执行命令**。
> --execute ：**执行命令**。

### pt-heartbeat

对于MySQL数据库主从复制延迟的监控，可以借助percona的有力武器pt-heartbeat来实现。
pt-heartbeat的工作原理通过使用时间戳方式在主库上更新特定表，然后在从库上读取被更新的时间戳然后与本地系统时间对比来得出其延迟。具体流程：
  1）在主上创建一张heartbeat表(--create-table参数创建)，按照一定的时间频率更新该表的字段（把时间更新进去）。监控操作运行后，heartbeat表能促使主从同步！
  2）连接到从库上检查复制的时间记录，和从库的当前系统时间进行比较，得出时间的差异。

```bash
# 更新主库上的heartbeat,--interval=1表示1秒钟更新一次（注意这个启动操作要在主库服务器上执行,保证可以同步heartbeat表？）
pt-heartbeat  --host=172.27.241.108 --port=3306  --user=root  --ask-pass --create-table -D huanqiu --interval=1 --update --replace --daemonize

# 查看有pt-heartbeat进程在不断地更新heartbeat表
ps -ef|grep pt-heartbeat

# 在主库运行监测同步延迟
pt-heartbeat -D huanqiu --table=heartbeat --monitor --host=172.27.241.108 --user=root  --port=3306 --password=**** --master-server-id=1
```

同pt-table-checksum，会在主库上的对应库下创建heartbeat表(使用--create-table参数)，一般创建后从库会同步这张表（不同步的话，就在从库那边手动也手动创建）  

```sql
CREATE TABLE heartbeat (            
ts                    varchar(26) NOT NULL,
server_id             int unsigned NOT NULL PRIMARY KEY,
file                  varchar(255) DEFAULT NULL,
position              bigint unsigned DEFAULT NULL,
relay_master_log_file varchar(255) DEFAULT NULL,
exec_master_log_pos   bigint unsigned DEFAULT NULL
);
```

### 遇到错误

在执行上述命令时，我有遇到这个错误，应该是这个版本的bug

```bash
[root@o0000344041-app ~]# pt-table-checksum ....
Can't use an undefined value as an ARRAY reference at /usr/bin/pt-table-checksum line 888.
```

做如下修改即可：

```bash
[root@o0000344041-app ~]# vim /usr/bin/pt-table-checksum
if ( @$instances_to_check ) 
#修改为
if ( $instances_to_check ) 
```

## 其它注意事项

一般地，搭建主从复制库时主从都没有数据，如果主库一开始有数据库和表结构以及数据，需要将主库的表结构先导入到从库中。

```bash
docker exec 9bee8fd7121c sh -c "exec mysqldump  -u root -p***** -q -R --no-data --all-databases | gzip" > dbschemes.sql

docker exec -it mysql /bin/bash

mysql -uroot -p***** < /temp/dbschemes.sql
```

## *参考：*

主从搭建参考：<https://www.cnblogs.com/haima/p/14341903.html>

主从原理：<https://www.cnblogs.com/wade-lt/p/9008058.html>

Percona Toolkit官网：<https://docs.percona.com/percona-toolkit/>

Percona 还有很多小工具后面可以研究研究：<https://www.percona.com/software/documentation>

Mysql主从环境部署一段时间后，发现主从不同步时，如何进行数据同步至一致？
有以下两种做法：
1）参考：
<http://www.cnblogs.com/kevingrace/p/6261111.html>

2）参考：mysql主从同步(3)-percona-toolkit工具（数据一致性监测、延迟监控）使用梳理
<https://www.cnblogs.com/kevingrace/p/6261091.html>



错误解决：

<https://blog.51cto.com/yujianglei/1729129>

<https://blog.csdn.net/renren_100/article/details/123310238>

<https://forums.percona.com/t/pt-table-checksum-deep-recursion-error/2599>

