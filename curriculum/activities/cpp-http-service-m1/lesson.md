# Portfolio Project 3：C++ HTTP 服务

先实现不依赖 socket 的服务核心。输入是已经解析出的 path，输出是显式的 `Response` 值。

这样可以在毫秒级测试路由契约，并让 loopback 传输、HTTP 解析、业务规则和指标采集各自拥有清晰责任。后续接入真实网络时，核心行为不需要跟着资源生命周期一起重写。
