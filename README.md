
# yapi-plugin-import-rap2

在[yapi-plugin-import-rap](https://github.com/wxxcarl/yapi-plugin-import-rap) 基础上修改 定制rap2导入
1. `yapi plugin --name yapi-plugin-import-rap2`

2. 在config.json中新增插件配置
    <pre>
    "plugins": [{
        "name": "import-rap2",
        "options": {
            "rapOrigin": "http://192.168.1.100:8000" // rap2项目地址
        }
    }]
    </pre>

3. 在yapi项目的菜单中会增加“rap2项目导入”菜单，填写rap project id ，执行即可。


### 说明：

* Project Id：
在RAP中点入项目之后，查看浏览器地址栏中的“id=”


* 导入的文件夹：
导入之后以接口的模块建立文件夹，即rap2进入项目后内容区域顶部的Tab


* 接口名称前缀：
如果rap2项目中接口列表有分多个group，则在接口名称前面添加group名称




