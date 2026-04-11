export const CUSTOMER_SOURCE_OPTIONS = [
    '自主招商',
    '以商招商',
    '朋友',
    '园区',
];

export function getCustomerSourceRemarkPlaceholder(sourceInfo?: string | null) {
    switch (sourceInfo) {
        case '以商招商':
            return '例如：王总转介绍、老客户李总推荐';
        case '自主招商':
            return '例如：短视频线索、官网咨询、地推获客';
        case '朋友':
            return '例如：张三介绍、朋友推荐';
        case '园区':
            return '例如：XX园区招商主管对接';
        default:
            return '补充来源说明';
    }
}
