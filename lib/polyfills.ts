/**
 * Bổ sung vài hàm JavaScript mà Safari/iOS cũ chưa có. Chạy bằng thẻ script trong <head>,
 * TRƯỚC mọi mã của app, để thư viện bên thứ ba cũng dùng được. Chỉ định nghĩa khi máy chưa có sẵn.
 */
export const POLYFILLS = `(function(){
try{
var d=function(o,n,f){if(!o[n])Object.defineProperty(o,n,{value:f,writable:true,configurable:true});};
d(Array.prototype,'at',function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return this[n];});
d(String.prototype,'at',function(n){n=Math.trunc(n)||0;if(n<0)n+=this.length;return n<0||n>=this.length?undefined:this.charAt(n);});
d(Array.prototype,'findLast',function(f,t){for(var i=this.length-1;i>=0;i--){if(f.call(t,this[i],i,this))return this[i];}});
d(Array.prototype,'findLastIndex',function(f,t){for(var i=this.length-1;i>=0;i--){if(f.call(t,this[i],i,this))return i;}return -1;});
d(Array.prototype,'toSorted',function(f){return this.slice().sort(f);});
d(Array.prototype,'toReversed',function(){return this.slice().reverse();});
d(String.prototype,'replaceAll',function(a,b){return a instanceof RegExp?this.replace(a,b):this.split(a).join(b);});
d(Object,'hasOwn',function(o,k){return Object.prototype.hasOwnProperty.call(o,k);});
d(window,'structuredClone',function(v){return v===undefined?v:JSON.parse(JSON.stringify(v));});
d(Promise,'withResolvers',function(){var r,j;var p=new Promise(function(a,b){r=a;j=b;});return{promise:p,resolve:r,reject:j};});
if(typeof AbortSignal!=='undefined'&&!AbortSignal.timeout){AbortSignal.timeout=function(ms){var c=new AbortController();setTimeout(function(){c.abort();},ms);return c.signal;};}
if(window.crypto&&!window.crypto.randomUUID){window.crypto.randomUUID=function(){var b=new Uint8Array(16);window.crypto.getRandomValues(b);b[6]=b[6]&15|64;b[8]=b[8]&63|128;var h=Array.prototype.map.call(b,function(x){return('0'+x.toString(16)).slice(-2);}).join('');return h.slice(0,8)+'-'+h.slice(8,12)+'-'+h.slice(12,16)+'-'+h.slice(16,20)+'-'+h.slice(20);};}
}catch(e){}
})();`;
