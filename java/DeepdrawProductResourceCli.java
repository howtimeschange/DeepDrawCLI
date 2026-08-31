import cn.deepdraw.api.rest.request.BaseRequest;
import cn.deepdraw.api.rest.request.v2.ProductGetByIdRequest;
import cn.deepdraw.api.rest.response.DopResponse;
import cn.deepdraw.api.rest.response.Reply;
import com.alibaba.cloudapi.sdk.model.ApiRequest;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;

public class DeepdrawProductResourceCli {
  private static final String[] EXTENDED_QUERY_KEYS = new String[] {
    "skc",
    "material",
    "video",
    "detailPageSite",
    "excludeDetailPageModules",
    "tags"
  };

  private static class ExtendedProductGetByIdRequest extends ProductGetByIdRequest {
    private final JSONObject extraQuery;

    ExtendedProductGetByIdRequest(String appKey, String appSecret, String dopKey, String host, JSONObject extraQuery) {
      super(appKey, appSecret, dopKey, host);
      this.extraQuery = extraQuery == null ? new JSONObject() : extraQuery;
    }

    @Override
    protected void doSetQueies() {
      super.doSetQueies();
      for (String key : EXTENDED_QUERY_KEYS) {
        String value = text(extraQuery, key);
        if (value.length() > 0) {
          setQuery(key, value);
        }
      }
    }
  }

  private static String readStdin() throws Exception {
    ByteArrayOutputStream buffer = new ByteArrayOutputStream();
    byte[] chunk = new byte[8192];
    int read;
    while ((read = System.in.read(chunk)) != -1) {
      buffer.write(chunk, 0, read);
    }
    return new String(buffer.toByteArray(), "UTF-8");
  }

  private static String text(JSONObject object, String key) {
    String value = object == null ? null : object.getString(key);
    return value == null ? "" : value.trim();
  }

  private static Long longValue(JSONObject object, String key) {
    String value = text(object, key);
    return value.length() == 0 ? null : Long.valueOf(value);
  }

  private static Long firstLong(JSONObject preferred, JSONObject fallback, String key) {
    Long value = longValue(preferred, key);
    return value == null ? longValue(fallback, key) : value;
  }

  public static void main(String[] args) throws Exception {
    JSONObject input = JSON.parseObject(readStdin());
    JSONObject config = input.getJSONObject("config");
    JSONObject query = input.getJSONObject("query");

    ExtendedProductGetByIdRequest request = new ExtendedProductGetByIdRequest(
      text(config, "appKey"),
      text(config, "appSecret"),
      text(config, "dopKey"),
      text(config, "host"),
      query
    );
    Long merchantId = firstLong(query, config, "merchantId");
    if (merchantId != null) {
      request.setMerchantId(merchantId);
    }
    if (text(query, "productCode").length() > 0) {
      request.setProductCode(text(query, "productCode"));
    }
    if (text(query, "productId").length() > 0) {
      request.setProductId(text(query, "productId"));
    }
    if (text(query, "resource").length() > 0) {
      request.setResource(text(query, "resource"));
    }
    if (text(query, "wgId").length() > 0) {
      request.setWgId(text(query, "wgId"));
    }

    if ("1".equals(System.getenv("DEEPDRAW_SDK_DUMP_REQUEST"))) {
      Method prepare = BaseRequest.class.getDeclaredMethod("prepare");
      prepare.setAccessible(true);
      prepare.invoke(request);
      ApiRequest apiRequest = request.getApiRequest();
      JSONObject dump = new JSONObject(true);
      dump.put("status", 200);
      dump.put("method", apiRequest.getMethod() == null ? null : apiRequest.getMethod().toString());
      dump.put("path", apiRequest.getPath());
      dump.put("query", JSON.toJSON(apiRequest.getQuerys()));
      dump.put("body", apiRequest.getBodyStr() == null && apiRequest.getBody() != null ? new String(apiRequest.getBody(), "UTF-8") : apiRequest.getBodyStr());
      System.out.println(JSON.toJSONString(dump));
      return;
    }

    Reply reply = request.execute();
    JSONObject output = new JSONObject(true);
    output.put("status", reply.getStatus());
    DopResponse response = reply.getResponse();
    if (response != null) {
      JSONObject responseJson = new JSONObject(true);
      responseJson.put("code", response.getCode());
      responseJson.put("reason", response.getReason());
      responseJson.put("response", response.getResponse() == null ? null : response.getResponse().toString());
      responseJson.put("requestId", response.getRequestId());
      responseJson.put("timestamp", response.getTimestamp());
      responseJson.put("body", JSON.toJSON(response.getBody()));
      output.put("response", responseJson);
    }
    System.out.println(JSON.toJSONString(output));
  }
}
