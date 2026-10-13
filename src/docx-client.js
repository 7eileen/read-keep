import mammoth from 'mammoth/mammoth.browser';
export async function extractDocx(buffer){
  if(buffer.byteLength>10*1024*1024)throw new Error('Word 文件超过 10 MB。');
  // Raw text only: never render document-provided HTML or external resources.
  const result=await mammoth.extractRawText({arrayBuffer:buffer});
  if(result.value.length>60000)throw new Error('文章文字超过 60,000 字符，请分篇导入。');
  return result.value;
}
