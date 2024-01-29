import net from '@/request'
import { NetConfig } from '@/client/IAxiosConfig'
import { Resp返回实体GetInterbankNumber对象 } from '../Type/Resp返回实体GetInterbankNumber对象'

/**
 *	提交尾款订单
 * @param {any} [req] 携带请求头
 * @param {NetConfig} [config] 请求配置
 */
export function createsubmitRemainOrder(req: any, config?: NetConfig) {
	return net<Resp返回实体GetInterbankNumber对象>(
		{
			url: '/front/orderPre/create/submitRemainOrder',
			method: 'post',

			headers: req.headers,
		},
		config,
	)
}
