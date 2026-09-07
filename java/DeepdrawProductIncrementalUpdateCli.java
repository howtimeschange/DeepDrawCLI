import cn.deepdraw.api.rest.entity.Product;
import cn.deepdraw.api.rest.request.BaseRequest;
import cn.deepdraw.api.rest.request.v2.ProductIncrementalUpdateRequest;
import cn.deepdraw.api.rest.response.DopResponse;
import cn.deepdraw.api.rest.response.Reply;
import com.alibaba.cloudapi.sdk.model.ApiRequest;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Set;

public class DeepdrawProductIncrementalUpdateCli {
  private static final class IncrementalProduct extends Product {
    @Override
    public Set<String> getPlaces() {
      Set<String> places = super.getPlaces();
      return places != null && places.isEmpty() ? null : places;
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

  private static String optionalText(JSONObject object, String key) {
    if (object == null || !object.containsKey(key)) return null;
    String value = object.getString(key);
    return value == null || value.trim().isEmpty() ? null : value.trim();
  }

  private static JSONObject asObject(Object value) {
    if (value instanceof JSONObject) return (JSONObject) value;
    if (!(value instanceof Map)) return null;
    JSONObject object = new JSONObject(true);
    for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
      if (entry.getKey() != null) object.put(String.valueOf(entry.getKey()), entry.getValue());
    }
    return object;
  }

  private static JSONObject fieldsFromJson(JSONObject productJson) {
    JSONObject fields = asObject(productJson == null ? null : productJson.get("fields"));
    JSONObject productFields = asObject(productJson == null ? null : productJson.get("productFields"));
    JSONObject merged = new JSONObject(true);
    if (productFields != null) merged.putAll(productFields);
    if (fields != null) merged.putAll(fields);
    return merged;
  }

  private static String normalizedFieldName(String name) {
    if (name == null) return "";
    String trimmed = name.trim();
    return "商家SKU".equals(trimmed.replaceAll("\\s+", "")) ? "商家SKU" : trimmed;
  }

  private static boolean hasValue(Object value) {
    if (value == null) return false;
    if (value instanceof CharSequence) return value.toString().trim().length() > 0;
    if (value instanceof Map) return !((Map<?, ?>) value).isEmpty();
    if (value instanceof Collection) return !((Collection<?>) value).isEmpty();
    return true;
  }

  private static Object field(JSONObject fields, String name) {
    for (Map.Entry<String, Object> entry : fields.entrySet()) {
      if (name.equals(normalizedFieldName(entry.getKey()))) return entry.getValue();
    }
    return null;
  }

  private static boolean includesSizeTable(JSONObject fields) {
    for (String name : fields.keySet()) {
      if (normalizedFieldName(name).contains("尺码表")) return true;
    }
    return false;
  }

  private static void validateRelationships(JSONObject fields) {
    Object colors = field(fields, "颜色");
    Object sizes = field(fields, "尺码");
    Object skus = field(fields, "商家SKU");
    List<String> missing = new ArrayList<String>();
    if (hasValue(skus) && !hasValue(colors)) missing.add("颜色（商家SKU需要）");
    if (hasValue(skus) && !hasValue(sizes)) missing.add("尺码（商家SKU需要）");
    if (includesSizeTable(fields) && !hasValue(sizes)) missing.add("尺码（尺码表需要）");
    if (!missing.isEmpty()) throw new IllegalArgumentException("required product fields are missing: " + String.join(", ", missing));
  }

  private static Product productFromJson(JSONObject productJson, JSONObject fields) {
    Product product = new IncrementalProduct();
    String title = optionalText(productJson, "title");
    if (title != null) product.setTitle(title);
    String retailPrice = optionalText(productJson, "retailPrice");
    if (retailPrice != null) product.setRetailPrice(retailPrice);
    String remark = optionalText(productJson, "remark");
    if (remark != null) product.setRemark(remark);

    Object placesValue = productJson == null ? null : productJson.get("places");
    if (placesValue instanceof Collection) {
      Set<String> places = new LinkedHashSet<String>();
      for (Object place : (Collection<?>) placesValue) {
        if (place != null && !place.toString().trim().isEmpty()) places.add(place.toString().trim());
      }
      if (!places.isEmpty()) product.setPlaces(places);
    }
    for (Map.Entry<String, Object> entry : fields.entrySet()) {
      String name = normalizedFieldName(entry.getKey());
      if (!name.isEmpty() && entry.getValue() != null) product.addProductField(name, entry.getValue());
    }
    return product;
  }

  private static boolean safeCheck(Product product, String check) {
    try {
      if ("颜色".equals(check)) return product.checkColor();
      if ("尺码".equals(check)) return product.checkSizes();
      if ("商家SKU".equals(check)) return product.checkSkus();
      return product.checkSizeTable();
    } catch (RuntimeException error) {
      return false;
    }
  }

  private static void validateSdkFields(Product product, JSONObject fields) {
    List<String> invalid = new ArrayList<String>();
    if (hasValue(field(fields, "颜色")) && !safeCheck(product, "颜色")) invalid.add("颜色");
    if (hasValue(field(fields, "尺码")) && !safeCheck(product, "尺码")) invalid.add("尺码");
    if (hasValue(field(fields, "商家SKU")) && !safeCheck(product, "商家SKU")) invalid.add("商家SKU");
    if (includesSizeTable(fields) && !safeCheck(product, "尺码表")) invalid.add("尺码表");
    if (!invalid.isEmpty()) throw new IllegalArgumentException("product fields have invalid SDK format or relationships: " + String.join(", ", invalid));
  }

  public static void main(String[] args) throws Exception {
    try {
      JSONObject input = JSON.parseObject(readStdin());
      JSONObject config = input.getJSONObject("config");
      JSONObject query = input.getJSONObject("query");
      JSONObject productJson = input.getJSONObject("product");
      String productId = text(query, "productId");
      if (productId.isEmpty()) throw new IllegalArgumentException("query.productId is required");
      JSONObject fields = fieldsFromJson(productJson);
      validateRelationships(fields);
      Product product = productFromJson(productJson, fields);
      validateSdkFields(product, fields);

      ProductIncrementalUpdateRequest request = new ProductIncrementalUpdateRequest(
        text(config, "appKey"), text(config, "appSecret"), text(config, "dopKey"), text(config, "host")
      ).setProductId(productId).setProduct(product);

      if ("1".equals(System.getenv("DEEPDRAW_SDK_DUMP_REQUEST"))) {
        Method prepare = BaseRequest.class.getDeclaredMethod("prepare");
        prepare.setAccessible(true);
        prepare.invoke(request);
        ApiRequest apiRequest = request.getApiRequest();
        JSONObject dump = new JSONObject(true);
        dump.put("status", 200);
        dump.put("method", apiRequest.getMethod() == null ? null : apiRequest.getMethod().toString());
        dump.put("path", apiRequest.getPath());
        JSONObject safeQuery = new JSONObject(true);
        safeQuery.put("type", apiRequest.getQuerys().get("type"));
        safeQuery.put("productId", apiRequest.getQuerys().get("productId"));
        dump.put("query", safeQuery);
        dump.put("body", apiRequest.getBodyStr() == null ? new String(apiRequest.getBody(), "UTF-8") : apiRequest.getBodyStr());
        dump.put("checkColor", safeCheck(product, "颜色"));
        dump.put("checkSizes", safeCheck(product, "尺码"));
        dump.put("checkSkus", safeCheck(product, "商家SKU"));
        dump.put("checkSizeTable", safeCheck(product, "尺码表"));
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
    } catch (IllegalArgumentException error) {
      System.err.println("Invalid incremental product payload: " + error.getMessage());
      System.exit(2);
    }
  }
}
