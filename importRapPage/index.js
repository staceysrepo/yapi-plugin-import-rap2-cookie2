import './style.scss';
import axios from 'axios'
import React, { PureComponent as Component } from 'react';
import { connect } from 'react-redux';
import PropTypes from 'prop-types';
import { Input, message, Button } from 'antd';
import JSON5 from 'json5';

const Search = Input.Search;
@connect(state => {
  return {
    uid: state.user.uid + '',
    curdata: state.inter.curdata,
    currProject: state.project.currProject
  }
})
class ImportRap extends Component {
  constructor(props) {
    super(props);
  }
  static propTypes = {
    match: PropTypes.object,
    projectId: PropTypes.string
  };

  treeData(data) {   
    let cloneData = JSON.parse(JSON.stringify(data))
    return cloneData.filter(parent=>{
        let branchArr = cloneData.filter(child => parent['id'] == child['parentId']);
        branchArr.length>0 ? parent['children'] = branchArr : '';
        return parent['parentId'] === -1 ;
    })
  }

  formatDeep(treeData) {
    let res_body = {
      properties: {},
      required: [],
      title: "empty object",
      type: "object"
    }
    Object.keys(treeData).forEach(key => {
      let rp = treeData[key]
      let { id, name, required, rule, type, value, description } = rp
      if (required) {
        res_body.required.push(name)
      }
      type = type.toLocaleLowerCase()
      let children = rp.children || []
      
      /**
       * 数组类型
       * 如果有chilren 说明是数组对象
       * 无则说明是简单数组
       */
      if(type === 'array') {
        if(children.length){
          res_body.properties[name]={
            items: this.formatDeep(children),
            type: "array",
          }
        } else {
          let itemType = value.includes('["') ? 'string' : 'number'
          res_body.properties[name] = {
            items: {
              mock:{
                mock: itemType === 'number' ? '@integer(1, 999999)' : ('@'+itemType)
              },
              type: itemType
            },
            type: 'array'
          }
        }
        if (description) {
          res_body.description = description
        }
      } else {
        let len = rule && rule.indexOf('+') < 0 && rule.indexOf('.') < 0 ? rule : 0
        let mockRule
        if(type === 'number'){
          if(rule && rule.indexOf('+') > -1) {
            mockRule = `@increment(${rule.replace('+','')})`
          } else if(rule && rule.indexOf('.') > -1) {
            mockRule = '@float(1, 999999, 1, 10)'
          } else{
            mockRule = '@integer(1, 999999)'
          }
        } else {
          mockRule = '@string'
        }
        // 特殊字母不设置mock
        let canUseValue = /^[0-9a-zA-Z_\u4e00-\u9fa5]{1,}$/g.test(rp.value)
        let ps = {
          description: rp.description || '',
          mock: mockRule ? { mock: mockRule } : canUseValue ? rp.value : '',
          default: rp.value || '',
          type: type,
        }
        if(type === 'object' && description) {
          res_body.description = description
        }
        if(children.length === 0){
          res_body.properties[name] = ps
        } else {
          res_body.properties[name] = this.formatDeep(children)
        }
      }
    })
    return res_body
  }

  addInterface(interfaces, catid){
    interfaces.forEach( interfaceItem => {
      let { name, method, url, properties } = interfaceItem
      let originReg = /(.+)\$?\{([a-zA-Z0-9]+)\}/g
      let getPathParamsReg = /\/\:([a-zA-Z0-9]+)/g
      // 去除url空格
      url = url.replace(/\s+/g, '')
      url = url.startsWith('/') ? url : `/${url}`
      // url动态参数 ${}改为:形式
      url = url.replace(originReg, "$1:$2")

      // 提取url参数
      let matchResult = getPathParamsReg.exec(url)
      let pathParams = matchResult && matchResult[1] ? matchResult[1] : ''
      // 入参类型 pos 1 HEAD 2 QUEEY 3 BODY
      // 入参过滤 HEAD
      let requestParams = []
      let requestHeaders = []
      let responseParams = []
      properties.map(prop => {
        if (prop.scope === 'request') {
          if (prop.pos === 1) {
            requestHeaders.push({
              desc: prop.description,
              name: prop.name,
              value: prop.value,
            })
          } else {
            requestParams.push(prop)
          }
        }else {
          responseParams.push(prop)
        }
      })
      if (method === 'POST') {
        requestHeaders.push({name: "Content-Type", value: "application/json"})
      }
      let createParams = {
        catid,
        method,
        path: url,
        project_id: this.props.match.params.id,
        title: name
      }
      axios.post('/api/interface/add', createParams).then(res3 => {
        if(res3.data.errcode !== 0){
          message.error(`插入${name}失败: ${res3.data.errmsg}`);
          console.error(`插入${name}失败: ${res3.data.errmsg}`);
          return false
        }
        let interface_id = res3.data.data._id
        let req_query = []
        let req_body_other = {
          properties: {},
          required: [],
          title: "empty object",
          type: "object"
        }
        if(method === 'GET') {
          requestParams.forEach( rp => {
            req_query.push({
              desc: rp.description,
              example: rp.value,
              name: rp.name,
              required: rp.required ? '1' : '0'
            })
          })
        } else {
          req_body_other = this.formatDeep(this.treeData(requestParams))
        }

        let res_body = this.formatDeep(this.treeData(responseParams))

        let upparams = Object.assign({
          api_opened: false,
          catid: '',
          desc: '',
          id: interface_id,
          markdown: '',
          method: '',
          path: '',
          req_body_form: [],
          req_body_is_json_schema: true,
          req_body_other: method === 'GET' ? undefined : JSON5.stringify(req_body_other),
          req_body_type: method === 'GET' ? undefined : 'json',
          req_headers: requestHeaders,
          req_params: pathParams ? [{ name: pathParams }] : [],
          req_query: method === 'GET' ? req_query : undefined,
          res_body: JSON5.stringify(res_body),
          res_body_is_json_schema: true,
          res_body_type: 'json',
          status: 'done',
          switch_notice: true,
          tag: [],
          title: ''
        }, createParams)
        delete upparams.project_id
        axios.post('/api/interface/up', upparams).then(upres => {
          if(upres.data.errcode === 0){
            message.success(`插入接口${name}成功`);
          } else {
            message.error(`插入接口${name}失败: ${upres.data.errmsg}`)
            console.error(`插入接口${name}失败: ${upres.data.errmsg}`)
          }
        })
      })
    })
  }

  importFromRap = async(id) => {
    let project_id = this.props.match.params.id
    // 先批量删除 当前项目下所有分类
    const { data = {} } = await axios.get(`/api/interface/list_menu?project_id=${project_id}`)
    const catList = data.data || []
    for(let i = 0; i < catList.length; i++) {
      let item = catList[i]
      const result = await axios.post(`/api/interface/del_cat`, { catid: item._id})
    }
    const rap2Result = await axios.get('/api/plugin/rap/get?id='+id+'&project_id='+project_id)
    if(rap2Result.data.errcode === 0){
      message.success(`远程获取RAP数据成功`);
      console.log('rap数据=>', rap2Result.data.data)
    } else {
      message.error(rap2Result.data.errmsg||'[请检查projectID是否存在]')
      return false
    }
 
    rap2Result.data.data.forEach( module => {
      let { name, description, interfaces } = module
      axios.post('/api/interface/add_cat', {
        desc: description,
        name: name,
        project_id
      }).then(yapiResult => {
        if(yapiResult.data.errcode === 0){
          message.success(`新增接口分类[${name}]成功`);
          let catid = yapiResult.data.data._id
          this.addInterface(interfaces, catid)
        } else {
          message.error(yapiResult.data.errmsg)
        }
      })
    })
  }

  render() {
    return (
      <div className="g-row">
        <section className="news-box m-panel">
          <div className="Mockurl">
            <span>rap2项目id：</span>
            <Search
              placeholder="Rap project id"
              enterButton="执行导入"
              size="large"
              onSearch={id => this.importFromRap(id)}
            />
          </div>
          
          <div className="rap-help">
            <h3>* 项目 Id：</h3>
            <p>在rap2中点入项目之后，查看浏览器地址栏中的“id=”</p>
            <br />
            <h3>* 导入的文件夹：</h3>
            <p>
              导入之后以接口的模块建立文件夹，即rap2进入项目后内容区域顶部的Tab
            </p>
            <br />
            <h3>* 接口名称前缀：</h3>
            <p>如果RAP项目中接口列表有分多个group，则在接口名称前面添加group名称</p>
          </div>
        </section>
      </div>
    );
  }
}

export default ImportRap;
