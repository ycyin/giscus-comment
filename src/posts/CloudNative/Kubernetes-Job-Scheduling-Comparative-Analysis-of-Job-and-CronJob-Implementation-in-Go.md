---
title: 'Kubernetes任务调度实践-Go语言实现Job和CronJob对比分析'
date: 2023-09-29 11:09:27
tag:
  - k8s
  - Go
category: 云原生
description: 本文详细介绍了如何通过Kubernetes中的Go语言调用API Server来实现创建Job任务。该功能需要实现创建Job执行任务、任务完成后提取日志中的JSON并解析入库,以及支持周期执行等步骤
---
本文详细介绍了如何通过Kubernetes中的Go语言调用API Server来实现创建Job任务。该功能需要实现创建Job执行任务、任务完成后提取日志中的JSON并解析入库,以及支持周期执行等步骤。这些都得益于[client-go](https://github.com/kubernetes/client-go)包的支持才能轻松实现,但在实践中也遇到了一些值得记录的问题。

<!-- more -->
# 使用Job实现
## 创建k8s连接
为创建Kubernetes连接,我们可以使用kubeconfig文件得到一个Kubernetes客户端。有了该客户端,后续对API的调用都可以通过它完成。伪代码（减少一些nil判断只保留关键步骤）：
```go
kubeconfigfilepath := "~/.kube/config"
// 从路径读取配置
conf, _ :=clientcmd.BuildConfigFromFlags("", kubeconfigfilepath)
// 或直接读取文件内容
//kubeconfig := "kubeconfig文件yaml内容"
//kubeconfigGetter := func() (*api.Config, error) {  
// data, err := os.ReadFile(kubeconfig)  
// if err != nil {  
//    return nil, err  
// }  
// return clientcmd.Load(data)  
//}  
//conf, _ := clientcmd.BuildConfigFromKubeconfigGetter("", kubeconfigGetter)
K8sClient, _ := kubernetes.NewForConfig(conf)
```
## 使用Create API创建Job并获取日志
调用Create API来创建一个Job对象。创建完成后,使用wait.PollImmediate函数等待Job运行结束。然后根据Job名称获取对应的Pod,并调用Get Logs API获取Pod日志。日志内容存在buf变量中返回。
```go
import (  
   batchv1 "k8s.io/api/batch/v1"  
   v1 "k8s.io/api/core/v1"  
   metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"  
   "k8s.io/apimachinery/pkg/util/wait"   
   "k8s.io/client-go/kubernetes"   
   "k8s.io/client-go/rest"   
   "k8s.io/client-go/tools/clientcmd"
   )
func (t K8sClient) CreateJob(ns, name string, spec v1.PodSpec) (string, error) {  
   jobDef := &batchv1.Job{  
      TypeMeta: metav1.TypeMeta{  
         Kind:       "Job",  
         APIVersion: "batch/v1",  
      },  
      ObjectMeta: metav1.ObjectMeta{  
         Namespace: ns,  
         Name:      name,  
      },  
      Spec: batchv1.JobSpec{  
         BackoffLimit: new(int32), // 设置重试次数  
         Template: v1.PodTemplateSpec{  
            Spec: spec,  
         },  
      },  
   }  
  
   // 使用Create API Job创建  
   job, err := t.clientSet.BatchV1().Jobs(ns).Create(context.TODO(), jobDef, metav1.CreateOptions{})  
   if err != nil {  
      return "", err  
   }  
  
   // 使用 wait.Until 函数等待 Job 完成  
   err = wait.PollImmediate(time.Second, time.Duration(300)*time.Second, func() (bool, error) {  
      job, err = t.clientSet.BatchV1().Jobs(ns).Get(context.TODO(), name, metav1.GetOptions{})  
      if err != nil {  
         return false, err  
      }  
      return job.Status.Succeeded > 0 || job.Status.Failed > 0, nil  
   })  
  
   if err != nil {  
      return "", err  
   }  
  
   // 获取 Pod 日志  
   podList, err := t.clientSet.CoreV1().Pods(ns).List(context.TODO(), metav1.ListOptions{  
      LabelSelector: fmt.Sprintf("job-name=%s", name),  
   })  
  
   if err != nil || len(podList.Items) == 0 {  
      return "", fmt.Errorf("failed to retrieve pod logs")  
   }  
  
   podName := podList.Items[0].Name  
   podLogOptions := v1.PodLogOptions{}  
   req := t.clientSet.CoreV1().Pods(ns).GetLogs(podName, &podLogOptions)  
   podLogs, err := req.Stream(context.Background())  
   if err != nil {  
      return "", err  
   }  
   defer func(podLogs io.ReadCloser) {  
      err := podLogs.Close()  
      if err != nil {  
         log.Print(err)  
      }  
   }(podLogs)  
  
   buf := new(bytes.Buffer)  
   _, err = io.Copy(buf, podLogs)  
   if err != nil {  
      return "", err  
   }  
   return buf.String(), nil  
}
```
调用方法创建具体的Pod并获取日志：
```go
func createKrrJob() string {  
  
   // 定义参数  
   spec := v1.PodSpec{  
      Containers: []v1.Container{  
         {  
            Name:            "krr-container",  
            Image:           "registry.cn-hangzhou.aliyuncs.com/ycyin/krr:v1.6.0", // 容器使用的镜像  
            ImagePullPolicy: "IfNotPresent",  
            Command:         []string{"/bin/sh", "-c", "python krr.py simple -f json"},  
         },  
      },  
      RestartPolicy:      "Never",  
      ServiceAccountName: sa,  
   }  
  
   // 调用函数创建Pod并获取日志  
   result, err := k.CreateJob(ns, jobName, spec)  
   if err != nil {  
      log.Printf("CreateJob failed with error: %v", err)  
   }  
  
   return result  
}
```
## 使用Apply API创建Job
为了更贴近kubectl的实际用法,我们也可以使用Apply API来创建Job。需要注意的是Apply API定义在applyconfigurations包中。另外需要指定一个FieldManager参数。
```go
import (  
   batchv1 "k8s.io/api/batch/v1"  
   "k8s.io/api/batch/v1beta1"   
   v1 "k8s.io/api/core/v1" 
   "k8s.io/apimachinery/pkg/util/wait"
   applybatchv1 "k8s.io/client-go/applyconfigurations/batch/v1"  
   corev1 "k8s.io/client-go/applyconfigurations/core/v1"  
   "k8s.io/client-go/kubernetes"   
   "k8s.io/client-go/rest"   
   "k8s.io/client-go/tools/cache"   
   "k8s.io/client-go/tools/clientcmd"   
   "k8s.io/client-go/tools/clientcmd/api")
   
func (t K8sClient) ApplyJob(ns, name string, spec corev1.PodSpecApplyConfiguration) (string, error) {  
   jobDef := applybatchv1.Job(name, ns).WithSpec(&applybatchv1.JobSpecApplyConfiguration{  
      Template: &corev1.PodTemplateSpecApplyConfiguration{  
         Spec: &spec,  
      },  
   })  
  
   // Job Apply  
   job, err := t.clientSet.BatchV1().Jobs(ns).Apply(context.TODO(), jobDef, metav1.ApplyOptions{  
      FieldManager: "application/apply-patch",  
   })  
   if err != nil {  
      return "", err  
   }  
   return job.Name, nil  
}

```
调用时,需要构造Job的配置对象,然后调用Apply方法。
使用Apply API与直接Create API相比,主要区别在于 Apply 会基于服务端当前状态做三向合并,而 Create 如果资源已存在会直接返回错误。
```go
import (  
   v1 "k8s.io/api/core/v1"  
   corev1 "k8s.io/client-go/applyconfigurations/core/v1" 

)  
  
var (  
   k        *client.K8sClient  
)
func init() {  
   k = client.NewK8sClient()  
}  
  
func createKrrJob() {  
  
   pullPolicy := v1.PullIfNotPresent  
   restartPolicy := v1.RestartPolicyNever  
   containName := "krr"  
   // 定义参数  
   spec := corev1.PodSpecApplyConfiguration{  
      Containers: []corev1.ContainerApplyConfiguration{  
         {  
            Name:            &containName,  
            Image:           &image,  
            ImagePullPolicy: &pullPolicy,  
            Command:         []string{"/bin/sh", "-c", command},  
         },  
      },  
      RestartPolicy:      &restartPolicy,  
      ServiceAccountName: &sa,  
   }  
  
   // 调用函数  
   jobName, err := k.ApplyJob(ns, jobName, spec)  
   if err != nil {  
      log.Printf("ApplyJob failed with error: %v", err)  
   } else {  
      log.Printf("ApplyJob Successfully!JobName：%s", jobName)  
   }  
}
```
## 评价
使用上述代码可以基本完成任务，但是会带来两个问题：
1. 我们需要周期执行任务,而Job是一次性的。所以需要自己实现定时重新创建Job的逻辑。（在代码里使用定时任务CronJob或者程序提供接口另外再创建一个K8s CronJob资源来调用接口实现重新创建Job的逻辑），并且就算是重新Apply（使用Apply API再调用）一次还是不能再次执行，都需要删除Job再创建。而删除Job的时机也确实是一个让我纠结的问题。
```go
func (t K8sClient) DeleteJob(namespace, jobName string) error {  
   // 使用客户端库删除 Job 
   backgroundDeletion := metav1.DeletePropagationBackground  
   err := t.clientSet.BatchV1().Jobs(namespace).Delete(context.TODO(), jobName, metav1.DeleteOptions{  
      // 同步删除Pod  
      PropagationPolicy: &backgroundDeletion,  
   })  
   if err != nil {  
      return err  
   }  
   return nil  
}
```
2.  代码中使用`wait.PollImmediate`来等待Job执行完成再去获取日志。我们硬编码了超时时间，如果Job实际运行超过这个时间,就会提前返回,获取不到日志。这个问题可以通过事件监听来解决。

# 关于事件监听器
要解决等待Job完成时可能超时的问题,我们可以使用事件监听器。

首先通过Informer监听Job的事件。然后在回调函数中处理执行完成的事件。这样就可以延长等待时间,确保获取到日志。
## 创建Informer监听Job的事件
```go
import (  
  batchv1 "k8s.io/api/batch/v1"  
)

func (t K8sClient) JobEventHandler(ns, jobName string, execAction func(string, string)) {  
   if jobName == "" {  
      return  
   }  
   // 创建一个Job的Informer来监听Job的事件  
   factory := informers.NewSharedInformerFactoryWithOptions(t.clientSet, 0, informers.WithNamespace(ns))  
   informer := factory.Batch().V1().Jobs().Informer()  
  
   // 设置资源添加、更新和删除事件的处理函数  
   informer.AddEventHandler(cache.ResourceEventHandlerFuncs{  
      AddFunc: func(obj interface{}) {  
         job := obj.(*batchv1.Job)  
         if strings.Contains(job.Name, jobName) {  
            fmt.Printf("New Job Added: %s\n", job.Name)  
         }  
      },  
      UpdateFunc: func(oldObj, newObj interface{}) {  
         oldJob := oldObj.(*batchv1.Job)  
         newJob := newObj.(*batchv1.Job)  
         // 判断目标Job  
         if strings.Contains(oldJob.Name, jobName) || strings.Contains(newJob.Name, jobName) {  
            fmt.Printf("job Status: %s:%v -> %s:%v\n", oldJob.Name, oldJob.Status.Succeeded, newJob.Name,  
               newJob.Status.Succeeded)  
            // 如果Job成功,执行回调方法  
            if newJob.Status.Succeeded == 1 {  
               go func(namespace, jobName string) {  
                  execAction(namespace, jobName)  
               }(ns, newJob.Name)  
            }  
         }  
      },  
      DeleteFunc: func(obj interface{}) {  
         job := obj.(*batchv1.Job)  
         if strings.Contains(job.Name, jobName) {  
            fmt.Printf("job Deleted: %s\n", job.Name)  
         }  
      },  
   })  
  
   // 启动Informer  
   stopper := make(chan struct{})  
   defer close(stopper)  
   factory.Start(stopper)  
  
   fmt.Println("JobEventHandler Created.")  
   // 等待事件  
   select {}  
}
```
## 启动事件监听器
这个事件监听器只需全局注册一个，在某个init函数中调用一次上面的JobEventHandler就可以了。需要注意的是为了能够持续监听事件我们在事件监听器中使用了`select {}`，所以需要在协程中启动事件监听,否则会阻塞主线程。

```go
func init() {  
   k = client.NewK8sClient()  
  
   // 一次只起一个事件监听器  
   go k.JobEventHandler(ns, jobName, func(ns, jobName string) {  
      logs, err := k.GetJobPodLogs(ns, jobName)  
      if err != nil {  
         log.Printf("获取日志报错：%v", err)  
         return  
      }  
      saveJsonUnMarsal(logs)  
  
      if err := k.DeleteJob(ns, jobName); err != nil {  
         log.Printf("删除Job失败，Error：%s", err)  
      }  
   })  
}
```
# 使用CronJob实现
我们也可以直接使用CronJob资源来实现周期执行任务。CronJob可以根据设定的调度期程定期创建Job，不需要自己实现调度逻辑。
## 代码
需要注意的是CronJob在K8s 1.21版本中才正式处于GA状态[CronJob | Kubernetes](https://kubernetes.io/zh-cn/docs/concepts/workloads/controllers/cron-jobs/)，再此之后CronJob在APIVersion `batch/v1`下：
```go
import (  
   errs "errors"  
   batchv1 "k8s.io/api/batch/v1"  
   v1 "k8s.io/api/core/v1"  
   "k8s.io/apimachinery/pkg/api/errors"
   metav1 "k8s.io/apimachinery/pkg/apis/meta/v1"  
   "k8s.io/apimachinery/pkg/util/wait"
   "k8s.io/client-go/informers"
   "k8s.io/client-go/kubernetes"
   "k8s.io/client-go/rest"
   )
func (t K8sClient) CreateCronJob(ns, name, schedule string, spec v1.PodSpec) (string, error) {  
   successfulJobsHistoryLimit := int32(1)  
   failedJobsHistoryLimit := int32(3)  
   cronJobDef := &batchv1.CronJob{  
      TypeMeta: metav1.TypeMeta{  
         Kind:       "CronJob",  
         APIVersion: "batch/v1",  
      },  
      ObjectMeta: metav1.ObjectMeta{  
         Namespace: ns,  
         Name:      name,  
      },  
      Spec: batchv1.CronJobSpec{  
         Schedule: schedule,  
         JobTemplate: batchv1.JobTemplateSpec{  
            Spec: batchv1.JobSpec{  
               Template: v1.PodTemplateSpec{  
                  Spec: spec,  
               },  
            },  
         },  
         SuccessfulJobsHistoryLimit: &successfulJobsHistoryLimit, // 设置成功的Job的保留数量  
         FailedJobsHistoryLimit:     &failedJobsHistoryLimit,     // 设置失败的Job的保留数量  
      },  
   }  
  
   cronJob, err := t.clientSet.BatchV1().CronJobs(ns).Create(context.TODO(), cronJobDef, metav1.CreateOptions{})  
   if err != nil {  
      // 对应cronJob已经存在  
      if statusErr, ok := err.(*errors.StatusError); ok && statusErr.ErrStatus.Code == 409 {  
         fmt.Println(statusErr.ErrStatus.Message)  
         fmt.Println("继续执行后续步骤...")  
         return name, nil  
      } else {  
         return "", err  
      }  
   }  
   return cronJob.Name, nil  
}
```

而在K8s 1.21之前，CronJob在APIVersion `batch/v1beta1`下，代码中使用的包变为`k8s.io/api/batch/v1beta1`
```go
import (  
   errs "errors"  
   batchv1 "k8s.io/api/batch/v1"  
   "k8s.io/api/batch/v1beta1"
   "k8s.io/apimachinery/pkg/api/errors"
   )
func (t K8sClient) CreateCronJob(ns, name, schedule string, spec v1.PodSpec) (string, error) {  
   successfulJobsHistoryLimit := int32(1)  
   failedJobsHistoryLimit := int32(3)  
   cronJobDef := &v1beta1.CronJob{  
      TypeMeta: metav1.TypeMeta{  
         Kind:       "CronJob",  
         APIVersion: "batch/v1beta1", // 两个环境的k8s版本不一致，测试环境CronJob的APIVersion是batch/v1beta1，生产batch/v1  
      },  
      ObjectMeta: metav1.ObjectMeta{  
         Namespace: ns,  
         Name:      name,  
      },  
      Spec: v1beta1.CronJobSpec{  
         Schedule: schedule,  
         JobTemplate: v1beta1.JobTemplateSpec{  
            Spec: batchv1.JobSpec{  
               Template: v1.PodTemplateSpec{  
                  Spec: spec,  
               },  
            },  
         },  
         SuccessfulJobsHistoryLimit: &successfulJobsHistoryLimit, // 设置成功的Job的保留数量  
         FailedJobsHistoryLimit:     &failedJobsHistoryLimit,     // 设置失败的Job的保留数量  
      },  
   }  
  
   // TODO 改为Apply()  
   cronJob, err := t.clientSet.BatchV1beta1().CronJobs(ns).Get(context.TODO(), name, metav1.GetOptions{})  
   if err != nil {  
      if errors.IsNotFound(err) {  
         cronJob, err = t.clientSet.BatchV1beta1().CronJobs(ns).Create(context.TODO(), cronJobDef, metav1.CreateOptions{})  
         if err != nil {  
            return "", err  
         }  
      } else {  
         return "", err  
      }  
   } else {  
      cronJobDef.ObjectMeta.ResourceVersion = cronJob.ObjectMeta.ResourceVersion  
      cronJob, err = t.clientSet.BatchV1beta1().CronJobs(ns).Update(context.TODO(), cronJobDef, metav1.UpdateOptions{})  
      if err != nil {  
         return "", err  
      }  
   }  
   return cronJob.Name, nil  
}
```
## 评价
确实使用CronJob可以省事不少，无需另外实现周期调用的逻辑，也无需去管Job的增删操作，只需要创建一次CronJob就行了。当然，如果CronJob需要更新则需要再调用Update或者更改上面的代码将Create()改为使用Apply()也可。虽然方便了不少但是根据我们的需求也会有两个小问题：
1. 不同Kubernetes版本对CronJob API的支持不同,但需要处理好兼容性问题。比如上述代码中的APIVersion不同引起的调用API不同问题
2. 使用CronJob后就无法再通过API接口手动触发任务执行。
# 提取Pod日志中的JSON解析和入库
## 拉取Pod日志
提取Pod日志其实不难，只需要调用API即可，前面的代码也有涉及，我这里把它提取一个方法出来：
```go
func (t K8sClient) GetJobPodLogs(ns, jobName string) (string, error) {  
   // 获取 Pod 日志  
   podList, err := t.clientSet.CoreV1().Pods(ns).List(context.TODO(), metav1.ListOptions{  
      LabelSelector: fmt.Sprintf("job-name=%s", jobName),  
   })  
  
   if err != nil || len(podList.Items) == 0 {  
      return "", fmt.Errorf("failed to retrieve pod logs")  
   }  
  
   podName := podList.Items[0].Name  
   podLogOptions := v1.PodLogOptions{}  
   req := t.clientSet.CoreV1().Pods(ns).GetLogs(podName, &podLogOptions)  
   podLogs, err := req.Stream(context.Background())  
   if err != nil {  
      return "", err  
   }  
   defer func(podLogs io.ReadCloser) {  
      err := podLogs.Close()  
      if err != nil {  
         log.Print(err)  
      }  
   }(podLogs)  
  
   buf := new(bytes.Buffer)  
   _, err = io.Copy(buf, podLogs)  
   if err != nil {  
      return "", err  
   }  
   return buf.String(), nil  
}
```

## 提取日志中的JSON数据

Pod日志中有很多我们不需要的数据，最终我们需要入库的只是日志中的JSON数据，这需要一个算法来提取即可。考虑过使用正则来匹配，但是估计会有性能问题。
```go
func GetJSONFromString(input string) string {  
   var stack []rune  
   var temp, json string  
  
   for _, char := range input {  
      if char == '{' {  
         temp += string(char)  
         stack = append(stack, char)  
      } else if char == '}' {  
         if len(stack) > 0 {  
            stack = stack[:len(stack)-1]  
            temp += string(char)  
         }  
      } else if len(stack) > 0 {  
         temp += string(char)  
      }  
   }  
  
   if len(stack) == 0 {  
      // 移除控制和空格字符并添加到 jsons      
      json = removeControlCharacters(temp)  
      temp = ""  
   }  
   return json  
}
```

这个算法其实还有一点小瑕疵，如果日志中(input)有多个JSON块，这会被我这个算法提取到一个string字符串中，这会给后面的解析带来一些小困难。

## 解析JSON入库

解析JSON其实是比较耗时的，最终选择了<github.com/buger/jsonparser>这个库来解析JSON
```go

// 解析方法
var histories []krr.ScanHistory  
_, err = jsonparser.ArrayEach([]byte(str), func(value []byte, dataType jsonparser.ValueType, offset int, err error) {  
   ns, _, _, _ := jsonparser.Get(value, "object", "namespace")  
   name, _, _, _ := jsonparser.Get(value, "object", "name")  
   kind, _, _, _ := jsonparser.Get(value, "object", "kind")  
   pods, _, _, _ := jsonparser.Get(value, "object", "pods")  
   container, _, _, _ := jsonparser.Get(value, "object", "container")  
   allocations, _, _, _ := jsonparser.Get(value, "object", "allocations")  
   recommended, _, _, _ := jsonparser.Get(value, "recommended")  
   severity, _, _, _ := jsonparser.Get(value, "severity")  
   fmt.Println(string(ns), string(name), string(kind), string(container), string(allocations), string(recommended),  
      string(severity))  
   var result []interface{}  
   err = json.Unmarshal(pods, &result)  
   if err != nil {  
      return  
   }  
   fmt.Println(len(result))  
   histories = append(histories, krr.ScanHistory{  
      Namespace:   string(ns),  
      Name:        string(name),  
      Kind:        string(kind),  
      Container:   string(container),  
      Allocations: string(allocations),  
      Recommended: string(recommended),  
      Severity:    string(severity),  
      Pods:        len(result),  
   })  
}, "scans")
```

由于我们的需求是每次解析，如果主键存在则更新，不存在则更新。可以使用GORM框架的增强特性来实现：
```go
// 数据库实体(struct)
type ScanHistory struct {  
   Namespace   string `gorm:"primaryKey;type:varchar(100);not null" json:"namespace"` // NS  
   Name        string `gorm:"primaryKey;type:varchar(100);not null" json:"name"`      // Name  
   Kind        string `gorm:"primaryKey;type:varchar(100);not null" json:"kind"`      // 类型  
   Container   string `gorm:"primaryKey;type:varchar(100);not null" json:"container"` // Json  
   Allocations string `gorm:"type:varchar(1000)" json:"allocations"`                  // 分配json  
   Recommended string `gorm:"type:varchar(1000)" json:"recommended"`                  // 推荐json  
   Severity    string `gorm:"type:varchar(1000)" json:"severity"`                     // 严重性  
   Pods        int    `gorm:"type:int" json:"pods"`  
}

func UpsertScanHistories(scanHistories []ScanHistory) ([]ScanHistory, error) {  
   res := dbpool.GetDB().Clauses(clause.OnConflict{  
      Columns:   []clause.Column{{Name: "name"}, {Name: "namespace"}, {Name: "kind"}, {Name: "container"}},  
      DoUpdates: clause.AssignmentColumns([]string{"container", "allocations", "recommended", "severity", "pods"}), 
      // DoUpdates或者UpdateAll: true,
   }).Create(&scanHistories)  
   return scanHistories, res.Error  
}
```

# 总结
1. Go语言调用Kubernetes API来实现Job任务的两种方式 - 使用Job资源和使用CronJob资源，这两种方式各有利弊，使用是需要根据需求选择:
    使用Job资源,需要自己实现周期调度逻辑,以及处理Job的创建、监控运行状态、获取日志、删除Job等步骤。

    使用CronJob资源可以简化流程,不需要自己实现调度逻辑,但需要处理不同Kubernetes版本的兼容性问题。另外如果需要手动触发任务则可能需要做另外的工作。

 2. 监听Job事件可以使用Informer实现，可以通过事件回调来触发后续逻辑,也可以避免阻塞主线程。
 3. 解析JSON可以使用jsonparser库并不是必须要反序列为struct，这可以提高性能。可以使用GORM的Clauses实现多字段的“有则更新，无则插入”功能。