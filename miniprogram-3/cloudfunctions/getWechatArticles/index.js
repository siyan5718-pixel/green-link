// 云函数：获取公众号文章
const cloud = require('wx-server-sdk')
cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV })
const db = cloud.database()
const rp = require('request-promise')

// 公众号配置
const APPID = 'gh_c3c22a5e572c'
const APPSECRET = 'wx6736599b6b53f429'

exports.main = async (event, context) => {
  try {
    // 1. 获取 access_token
    const tokenUrl = `https://api.weixin.qq.com/cgi-bin/token?grant_type=client_credential&appid=${APPID}&secret=${APPSECRET}`
    const tokenRes = await rp({ url: tokenUrl, json: true })
    
    if (!tokenRes.access_token) {
      return { code: -1, msg: '获取token失败', data: [] }
    }
    
    // 2. 获取图文素材列表
    const materialUrl = `https://api.weixin.qq.com/cgi-bin/material/batchget_material?access_token=${tokenRes.access_token}`
    const articleRes = await rp({
      url: materialUrl,
      method: 'POST',
      json: true,
      body: { type: 'news', offset: 0, count: 10 }
    })
    
    if (articleRes.errcode) {
      return { code: -1, msg: '获取素材失败: ' + articleRes.errmsg, data: [] }
    }
    
    // 3. 清除旧数据
    const old = await db.collection('wechat_articles').get()
    for (const item of old.data) {
      await db.collection('wechat_articles').doc(item._id).remove()
    }
    
    // 4. 逐条插入新数据
    const articles = []
    for (const item of articleRes.item) {
      const news = item.content.news_item[0]
      const article = {
        title: news.title,
        digest: news.digest || '',
        url: news.url,
        author: news.author || '',
        source: '公众号',
        createTime: db.serverDate()
      }
      
      const result = await db.collection('wechat_articles').add({ data: article })
      articles.push({ ...article, _id: result.id })
    }
    
    return {
      code: 0,
      msg: 'success',
      data: articles
    }
  } catch (err) {
    console.error('获取失败：', err)
    return {
      code: -1,
      msg: err.message,
      data: []
    }
  }
}
