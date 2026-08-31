import cn.deepdraw.api.rest.entity.Product;
import cn.deepdraw.api.rest.request.BaseRequest;
import cn.deepdraw.api.rest.request.ProductPostIncrementalUpdateProductSkuColorByIdRequest;
import cn.deepdraw.api.rest.response.DopResponse;
import cn.deepdraw.api.rest.response.Reply;
import com.alibaba.cloudapi.sdk.model.ApiRequest;
import com.alibaba.fastjson.JSON;
import com.alibaba.fastjson.JSONObject;

import java.io.ByteArrayOutputStream;
import java.lang.reflect.Array;
import java.lang.reflect.Method;
import java.util.ArrayList;
import java.util.Collection;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;

public class DeepdrawProductSkuColorIncrementalUpdateCli {
  private static final String[] SIZE_FIELD_ALIASES = {
    "尺码",
    "尺码规格",
    "规格尺码",
    "规格",
    "尺寸规格",
    "商品规格",
    "尺寸",
    "规格尺码/含量",
    "产品规格"
  };

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
    if (object == null || !object.containsKey(key)) {
      return null;
    }
    String value = object.getString(key);
    if (value == null || value.trim().length() == 0) {
      return null;
    }
    return value.trim();
  }

  private static Long longValue(JSONObject object, String key) {
    String value = text(object, key);
    return value.length() == 0 ? null : Long.valueOf(value);
  }

  private static JSONObject asObject(Object value) {
    if (value instanceof JSONObject) {
      return (JSONObject) value;
    }
    if (!(value instanceof Map)) {
      return null;
    }
    JSONObject object = new JSONObject(true);
    for (Map.Entry<?, ?> entry : ((Map<?, ?>) value).entrySet()) {
      if (entry.getKey() != null) {
        object.put(String.valueOf(entry.getKey()), entry.getValue());
      }
    }
    return object;
  }

  private static JSONObject fieldsFromJson(JSONObject productJson) {
    if (productJson == null) {
      return null;
    }
    JSONObject fields = asObject(productJson.get("fields"));
    JSONObject productFields = asObject(productJson.get("productFields"));
    if (fields == null) {
      return productFields;
    }
    if (productFields == null) {
      return fields;
    }

    JSONObject merged = new JSONObject(true);
    merged.putAll(productFields);
    for (Map.Entry<String, Object> entry : fields.entrySet()) {
      merged.put(entry.getKey(), entry.getValue());
    }
    return merged;
  }

  private static String normalizedFieldName(String key) {
    if (key == null) {
      return "";
    }
    String trimmed = key.trim();
    if ("商家SKU".equals(trimmed.replaceAll("\\s+", ""))) {
      return "商家SKU";
    }
    return trimmed;
  }

  private static JSONObject normalizeFields(JSONObject fields) {
    JSONObject normalized = new JSONObject(true);
    if (fields == null) {
      return normalized;
    }
    for (Map.Entry<String, Object> entry : fields.entrySet()) {
      String key = normalizedFieldName(entry.getKey());
      Object value = entry.getValue();
      if (normalized.containsKey(key) && !Objects.equals(normalized.get(key), value)) {
        throw new IllegalArgumentException("duplicate aliases for product field " + key);
      }
      normalized.put(key, value);
    }
    return normalized;
  }

  private static Object requiredField(JSONObject fields, String... aliases) {
    if (fields == null) {
      return null;
    }
    Object selected = null;
    boolean found = false;
    for (String alias : aliases) {
      if (!fields.containsKey(alias)) {
        continue;
      }
      found = true;
      Object value = fields.get(alias);
      if (!hasUsableValue(value)) {
        return null;
      }
      if (selected == null) {
        selected = value;
      }
    }
    return found ? selected : null;
  }

  private static boolean hasUsableValue(Object value) {
    if (value == null) {
      return false;
    }
    if (value instanceof CharSequence) {
      return value.toString().trim().length() > 0;
    }
    if (value instanceof Map) {
      return !((Map<?, ?>) value).isEmpty();
    }
    if (value instanceof Collection) {
      return !((Collection<?>) value).isEmpty();
    }
    if (value.getClass().isArray()) {
      return Array.getLength(value) > 0;
    }
    return true;
  }

  private static String join(List<String> values) {
    StringBuilder result = new StringBuilder();
    for (String value : values) {
      if (result.length() > 0) {
        result.append(", ");
      }
      result.append(value);
    }
    return result.toString();
  }

  private static JSONObject validateRequiredFields(JSONObject productJson) {
    JSONObject fields = normalizeFields(fieldsFromJson(productJson));
    List<String> invalid = new ArrayList<String>();
    if (requiredField(fields, "颜色") == null) {
      invalid.add("颜色");
    }
    if (requiredField(fields, SIZE_FIELD_ALIASES) == null) {
      invalid.add("尺码");
    }
    if (requiredField(fields, "商家SKU") == null) {
      invalid.add("商家SKU");
    }
    if (!invalid.isEmpty()) {
      throw new IllegalArgumentException("required product fields are missing or empty: " + join(invalid));
    }
    return fields;
  }

  private static boolean safeCheck(String field, Product product) {
    try {
      if ("颜色".equals(field)) {
        return product.checkColor();
      }
      if ("尺码".equals(field)) {
        return product.checkSizes();
      }
      return product.checkSkus();
    } catch (RuntimeException error) {
      return false;
    }
  }

  private static void validateSdkFields(Product product) {
    List<String> invalid = new ArrayList<String>();
    if (!safeCheck("颜色", product)) {
      invalid.add("颜色");
    }
    if (!safeCheck("尺码", product)) {
      invalid.add("尺码");
    }
    if (!safeCheck("商家SKU", product)) {
      invalid.add("商家SKU");
    }
    if (!invalid.isEmpty()) {
      throw new IllegalArgumentException("required product fields have invalid SDK format or relationships: " + join(invalid));
    }
  }

  private static Product productFromJson(JSONObject productJson, JSONObject fields) {
    Product product = new IncrementalProduct();
    String code = optionalText(productJson, "code");
    if (code != null) {
      product.setCode(code);
    }
    String title = optionalText(productJson, "title");
    if (title != null) {
      product.setTitle(title);
    }
    String retailPrice = optionalText(productJson, "retailPrice");
    if (retailPrice != null) {
      product.setRetailPrice(retailPrice);
    }
    String date = optionalText(productJson, "date");
    if (date != null) {
      product.setDate(date);
    }
    String remark = optionalText(productJson, "remark");
    if (remark != null) {
      product.setRemark(remark);
    }

    Object placesValue = productJson == null ? null : productJson.get("places");
    if (placesValue instanceof java.util.Collection) {
      Set<String> places = new LinkedHashSet<String>();
      for (Object place : (java.util.Collection<?>) placesValue) {
        if (place != null && place.toString().trim().length() > 0) {
          places.add(place.toString());
        }
      }
      if (!places.isEmpty()) {
        product.setPlaces(places);
      }
    }
    if (fields != null) {
      for (Map.Entry<String, Object> entry : fields.entrySet()) {
        if (entry.getKey() != null) {
          product.addProductField(normalizedFieldName(entry.getKey()), entry.getValue());
        }
      }
    }
    return product;
  }

  public static void main(String[] args) throws Exception {
    try {
      JSONObject input = JSON.parseObject(readStdin());
      JSONObject config = input.getJSONObject("config");
      JSONObject query = input.getJSONObject("query");
      JSONObject productJson = input.getJSONObject("product");
      JSONObject fields = validateRequiredFields(productJson);
      Product product = productFromJson(productJson, fields);
      validateSdkFields(product);

      ProductPostIncrementalUpdateProductSkuColorByIdRequest request =
        new ProductPostIncrementalUpdateProductSkuColorByIdRequest(
          text(config, "appKey"),
          text(config, "appSecret"),
          text(config, "dopKey"),
          text(config, "host")
        ).setProductId(longValue(query, "productId"))
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
    } catch (IllegalArgumentException error) {
      System.err.println("Invalid incremental product payload: " + error.getMessage());
      System.exit(2);
    }
  }
}
