---
title: K8s云原生环境下文件描述符占用过高查询思路
date: 2024-06-14 10:59:41
tags:
  - k8s
  - Docker
category: 云原生
---

在K8s云环境下，如何查询某一Linux系统进程ID与Pod对应关系需要一定的技巧。本文利用在K8s集群中某一机器的文件描述符占用过高的问题，排查定位到对应Pod的一次经验记录Linux系统进程ID与Pod对应关系查询思路。

<!-- more -->

使用的Docker版本：19.03.5，部署机器：Red Hat Enterprise Linux Server 7.9（maipo），K8s版本：v1.17.2

使用Promethues监控机器（`node_filefd_allocated{instance=~"$node"}`），发现使用的文件描述符不断升高。
可以使用PromSQL直接查询机器所有Pod占用的文件描述符。
```bash
sort_desc(sum by (pod, namespace) (container_file_descriptors{container!="POD", id=~"/kubepods.slice/.*",instance="10.xx.xx.xx:10250"}))
```
查询结果如下所示：

|                                                       |      |
| ----------------------------------------------------- | ---- |
| {namespace="xxx", pod="api-67abc-7cb496dcd8-7p8rx"}   | 6919 |
| {namespace="xxx", pod="api-mock-7449d9649-z7llj"}     | 3943 |
| {namespace="yyy", pod="admin-a95c3-6965b98dbd-sr988"} | 1147 |
| {namespace="zzz", pod="sale-57fd89fcbd-qxzkc"}        | 1082 |
| {namespace="yyy", pod="demo-test-8899b9c4c-f5955"}    | 1080 |

本文提供另一种思路，从宿主机器的进程ID一路定位到具体的Pod。

# 确定问题
首先确定 Kubernetes 节点上的 Linux 系统最大可打开文件数量：

```bash
$ cat /proc/sys/fs/file-max
100000
```

再多次查看当前已打开的文件数量：

```bash
$ cat /proc/sys/fs/file-nr
76335 0 100000
$ cat /proc/sys/fs/file-nr
79220 0 100000
```

发现不断上涨中，已逼近系统的最大可打开文件数量极限。
# 初步判定
由于是K8s节点，首先想到的就是docker或kubelet是不是占用了过多文件描述符。通过以下命令查看Docker占用的文件描述符，kubelet查看方式也类似。
```bash
$ ps -ef | grep docker
root         456       1  0 09:52 ?        00:00:56 /usr/bin/dockerd -H fd:// --containerd=/run/containerd/containerd.sock
$ ls /proc/456/fd | wc -l
2110
```
这里说一下 Docker 默认使用 unix domain socket (IPC socket) 进行本地通讯，而 kubelet 通过 dockershim 将 CRI 请求转换成相应的 Docker API 请求发给 dockerd (Docker Daemon) 进程，所以 /var/run/docker.sock 是由 kubelet 使用。

要查看某个进程到底打开了多少文件，正常情况下 lsof当然可以做到，但是在极端情况下，lsof 都是无法正常使用的，我们这时就要通过 `/proc` 虚拟文件系统来查看进程的数据，`/proc/${pid}/fd` 这个路径下的文件与进程所打开的文件是一对一的关系，所以我们统计  `/proc/${pid}/fd` 路径下文件的数量就能够得到进程打开文件的数量。[^1]

查看是否由某个进程疯狂打开 /var/run/docker.sock 导致。
```bash
$ ss -a | grep "docker.sock" | wc -l
1054
$ ss -a | grep "docker.sock" | wc -l
1099
```
使用脚本持续打印出 kubelet 与全局已打开文件数量，查看打开文件数的增量
```bash
$ cat << 'EOF' > kubelet.sh
cat << 'EOF' > kubelet.sh
while true
do
    sock=$(ss -a | grep "docker.sock" | wc -l)
    fd=$(ls /proc/767196/fd | wc -l)
    file_nr=$(cat /proc/sys/fs/file-nr)
    echo "docker.sock: $sock; file opened: $fd; file-nr: $file_nr"
    sleep 10
done
EOF

$ sh kubelet.sh
docker.sock: 1099; file opened: 1690; file-nr: 92224 0 100000
docker.sock: 1099; file opened: 1690; file-nr: 92192 0 100000
docker.sock: 1099; file opened: 1690; file-nr: 92224 0 100000
```
检查后发现占用并不高，一定是有其它的服务在占用，从业务容器上下手。
使用脚本来观察所有进程使用文件的增量情况：
```bash
$ cat << 'EOF' > all.sh
while true
do
    total_files=0
    for proc in $(find /proc/ -maxdepth 1 -type d -name "[0-9]*")
    do
        fd=$(ls $proc/fd | wc -l)
        if [[ $fd -gt 500 ]]; then
            pid=$(echo $proc | awk -F/ '{print $3}')
            echo "Process $pid opened $fd files"
            total_files=$((total_files + fd))
        fi
    done
    echo "Total files opened: $total_files"
    echo "==========================="
    sleep 10
done
EOF 

$ sh all.sh
process 767196 opened 2772 files
process 2481311 opened 3940 files
ls: cannot access /proc/2525888/fd: No such file or directory 
ls: cannot access /proc/2525889/fd: No such file or directory 
process 3663251 opened 4201 files 
process 3663411 opened 1380 files
process 4007274 opened 5637 files
```
# 根据进程ID找出Pod
前面通过脚本找出了打开文件数较多的进程ID，通过以下几步可以确认对应的Pod
## pstree指令打印进程树
通过pstree指令，逐个打印出进程树，确认进程名
```bash
$ pstree -s 767196
systemd───dockerd───206_[{dockerd}]
$ pstree -s 2481311
systemd───kubelet───83*[{kubelet}]
$ pstree -s 3663251 
systemd───containerd───containerd-shim───tini───java───99_[{java}]
$ pstree -s 4007274 
systemd───containerd───containerd-shim───tini───java───64*[{java}]
```
由于我们大多数应用都是Java应用，确认Java进程就是我们要找的进程
## 找父进程
通过`ls /proc/<pid>/fd`找到的进程可能是一个java进程的子进程，可以通过ps指令查找父进程。
比如我这里3663251的父进程是3663411，才是真正的Java进程。
```bash
$ ps -o ppid= -p 3663251 
3663411
```
或者使用`pstree -p`也可以打印进程树时把进程ID同时显示出来
```bash
$ pstree -sp 3663251
systemd(1)───containerd(1666)───containerd-shim(2711841)───copy_plugins.sh(2711896)───java(3663411)───java(3663251)─┬─{java}(2712617)                                                                                ├─{java}(2712619)
.....
```
## 找进程对应的容器
依靠`docker inspect`命令，找出进程对应的容器ID，如果没查到，可能Pid是子进程ID,用父进程ID试试，如下：
```bash
$ docker ps -q | xargs -I {} docker inspect {} | grep -B 20 '"Pid": 3663411'

$ docker ps -q | xargs -I {} docker inspect {} | grep -B 20 '"Pid": 2711896'
    {
        "Id": "82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32",
        "Created": "2023-12-13T08:31:00.001807558Z",
        "Path": "/tmp/scripts/copy_plugins.sh",
        "Args": [],
        "State": {
            "Status": "running",
            "Running": true,
            "Paused": false,
            "Restarting": false,
            "OOMKilled": false,
            "Dead": false,
            "Pid": 2711896,
$ docker ps -q | xargs -I {} docker inspect {} | grep -B 20 '"Pid": 2711896' | grep -oP '"Id": "\K[^"]+'
82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32
```
或者使用`ll -tr`打印出进程打开的文件
```bash
$ ll -tr /proc/2711896/fd | tail -n 50
...
lr-x------ 1 root root 64 June 13 22:36 4560 -> /run/docker/containerd/82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32/4sdf897632141of34265lkh32134j53n0991234jl2k3jj41092443354365tdf87-stderr
l-wx------ 1 root root 64 June 13 22:36 4558 -> /run/docker/containerd/82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32/4sdf897632141of34265lkh32134j53n0991234jl2k3jj41092443354365tdf87-stderr
lr-x------ 1 root root 64 June 13 22:36 4556 -> /run/docker/containerd/82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32/4sdf897632141of34265lkh32134j53n0991234jl2k3jj41092443354365tdf87-stdout
l-wx------ 1 root root 64 June 13 22:36 4554 -> /run/docker/containerd/82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32/4sdf897632141of34265lkh32134j53n0991234jl2k3jj41092443354365tdf87-stdout
...
```
找到类似上面的输出，其中`82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32`就是容器ID。

## 找容器对应的Pod
使用如下命令可以将对应容器ID的NS和Pod名打印出来。
```bash
$ kubectl get pods --all-namespaces -o=jsonpath='{range .items[_]}{.metadata.namespace}{"\t"}{.metadata.name}{"\t"}{range .status.containerStatuses[_]}{.containerID}{"\n"}{end}{end}' | grep 82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32 | awk '{print $1" " $2}'
NamespaceName1 PodName
```
此时可以去找对应的业务系统排查问题了。
# 进一步找出原因

前面使用`ll -tr /proc/2711896/fd | tail -n 50`发现很多类似lr-x------ 1 root root 64 June 13 22:36 4560 -> `/run/docker/containerd/82414f376d1f157d67c526cd8209b6d55f986e90ee8ea453ff59cb1857856a32/4sdf897632141of34265lkh32134j53n0991234jl2k3jj41092443354365tdf87-stdout`这样的**软链接指向**输出。
这些都是命名管道文件，而我们常用的 `|` 竖线符号是匿名管道，**管道经常被用于父子进程间通讯**。

这些管道文件的命名都是以 `/run/docker/containerd/82414f376d1f1` 为前缀， 82414f376d1f1 就是某个容器的 ID

这些文件都是用来做啥的？

先看看 Docker 源码 <https://github.com/moby/moby>，创建命名管道也就是 Linux FIFO 的源码在 <https://github.com/moby/moby/blob/v19.03.12/libcontainerd/remote/client_linux.go#L97-L122>
```go
func newFIFOSet(bundleDir, processID string, withStdin, withTerminal bool) *cio.FIFOSet {
    config := cio.Config{
        Terminal: withTerminal,
        Stdout:   filepath.Join(bundleDir, processID+"-stdout"),
    }
    paths := []string{config.Stdout}
 
    if withStdin {
        config.Stdin = filepath.Join(bundleDir, processID+"-stdin")
        paths = append(paths, config.Stdin)
    }
    if !withTerminal {
        config.Stderr = filepath.Join(bundleDir, processID+"-stderr")
        paths = append(paths, config.Stderr)
    }
    closer := func() error {
        for _, path := range paths {
            if err := os.RemoveAll(path); err != nil {
                logrus.Warnf("libcontainerd: failed to remove fifo %v: %v", path, err)
            }
        }
        return nil
    }
 
    return cio.NewFIFOSet(config, closer)
}
```
再找到 `newFIFOSet` 调用处 <https://github.com/moby/moby/blob/v19.03.12/libcontainerd/remote/client.go#L194>
```go
// Exec creates exec process.
//
// The containerd client calls Exec to register the exec config in the shim side.
// When the client calls Start, the shim will create stdin fifo if needs. But
// for the container main process, the stdin fifo will be created in Create not
// the Start call. stdinCloseSync channel should be closed after Start exec
// process.
func (c *client) Exec(ctx context.Context, containerID, processID string, spec *specs.Process, withStdin bool, attachStdio libcontainerdtypes.StdioCallback) (int, error) {
 
    // a lot of code here
 
    fifos := newFIFOSet(labels[DockerContainerBundlePath], processID, withStdin, spec.Terminal)
 
 
    p, err = t.Exec(ctx, processID, spec, func(id string) (cio.IO, error) {
        rio, err = c.createIO(fifos, containerID, processID, stdinCloseSync, attachStdio)
        return rio, err
    })
 
    // a lot of code here
}
```
根据源码分析，每当 exec 新进程，都会创建 Linux FIFO 也就是命名管道，从而占用系统文件描述符。

最终发现，是该业务Pod调用第三方服务做了一个心跳检测，检测周期是1秒，当三方服务挂掉，导致频繁创建的心跳检测连接不能及时关闭从而长时间占用文件描述符过多。

本文参考：

[^1]:  https://blog.csdn.net/alex_yangchuansheng/article/details/122613102
[^2]: https://blog.crazytaxii.com/posts/k8s_file_descriptor_leaks/