import cn.deepdraw.api.rest.entity.Product;
import cn.deepdraw.api.rest.request.BaseRequest;
import cn.deepdraw.api.rest.request.ProductPostCreateProductRequest;
import cn.deepdraw.api.rest.response.DopResponse;
import cn.deepdraw.api.rest.response.Reply;
import com.alibaba.cloudapi.sdk.model.ApiRequest;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;
import java.util.Map;

public class DeepdrawProductCreateCli {
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

  public static void main(String[] args) throws Exception {
    JSONObject input = JSON.parseObject(readStdin());
    JSONObject config = input.getJSONObject("config");
    JSONObject productJson = input.getJSONObject("product");

    Product product = new Product();
    product.setCode(text(productJson, "code"));
    product.setTitle(text(productJson, "title"));
    product.setRetailPrice(text(productJson, "retailPrice"));
    if (text(productJson, "date").length() > 0) {
      product.setDate(text(productJson, "date"));
    }

    JSONObject fields = productJson.getJSONObject("fields");
    if (fields != null) {
      for (Map.Entry<String, Object> entry : fields.entrySet()) {
        if (entry.getKey() != null && entry.getValue() != null) {
          product.addProductField(entry.getKey(), entry.getValue());
        }
      }
    }

    ProductPostCreateProductRequest request = new ProductPostCreateProductRequest(
      text(config, "appKey"),
      text(config, "appSecret"),
      text(config, "dopKey"),
      text(config, "host")
    ).setMerchantId(longValue(config, "merchantId"))
      .setTradeId(longValue(config, "tradeId"))
      .setProduct(product);

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
      dump.put("body", apiRequest.getBodyStr() == null ? new String(apiRequest.getBody(), "UTF-8") : apiRequest.getBodyStr());
      dump.put("checkColor", product.checkColor());
      dump.put("checkSizes", product.checkSizes());
      dump.put("checkSizeTable", product.checkSizeTable());
      dump.put("checkSkus", product.checkSkus());
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
