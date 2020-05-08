export default function request(method, url, data, headers) {
  const theHeaders = {...headers}
  return new Promise((resolve, reject) => {
    const handleSuccess = (data, textStatus, jqXHR) => {
      if (!data) {
        reject({"description": "no data", "code": -1})
        return;
      }
      if (jqXHR.status !== 200) {
        console.log("Server error");
        reject({"description": "Http code " + jqXHR.status, "code": -1}, observer);
        return;
      }
      if (jqXHR.getResponseHeader("Content-Type").indexOf("json") < 0) {
        console.log("Data format error " + jqXHR.getResponseHeader("Content-Type"));
        reject({
          "description": "Content-Type " + jqXHR.getResponseHeader("Content-Type"),
          "code": -1
        }, observer);
        return;
      }

      // var jsonData = JSON.insure(data);
      let jsonData
      try {
        jsonData = JSON.parse(data);
      } catch (e) {
        reject({code: -1, description: "Response data parse failed! " + JSON.stringify(data)})
        return
      }

      let code = jsonData["code"];
      if (typeof code === 'number') {
        if (code === 1) {
          resolve(jsonData)
        } else {
          let description = jsonData["message"];
          if (!description)
            description = "Unknown error";
          reject({code: -1, description, data: jsonData});
        }
        return;
      } else {
        console.log("Server error, no code");
        reject({"description": "No server code...", "code": -1}, observer);
      }
    }
    const handleError = (xhr, textStatus) => {
      console.log("Network error");
      let contentType = xhr.getResponseHeader("Content-Type");
      if (contentType === "application/json") {
        let response = xhr.responseText;
        let jsonData = null
        try {
          jsonData = JSON.parse(response);
        } catch (e) {
          console.error(e)
          return
        }
        let description = jsonData["description"];
        if (!description)
          description = "Unknown error";
        console.log(description);
        reject(jsonData);
      } else {
        reject({
          "description": "Network error textStatus " + textStatus,
          "code": -1
        });
      }
    }

    let xhr = undefined, ret = undefined;
    if (window.XMLHttpRequest) {  // code for IE7+, Firefox, Chrome, Opera, Safari
      xhr = new XMLHttpRequest();
    } else {  // code for IE6, IE5
      xhr = new ActiveXObject("Microsoft.XMLHTTP");
    }
    let async = true;
    xhr.open(method, url, async);
    // xhr.withCredentials = true
    xhr.setRequestHeader("Content-Type", theHeaders["Content-Type"] || headers["content-type"] || headers["contentType"] || "application/json");
    delete theHeaders["content-type"];
    delete theHeaders["Content-Type"];
    delete theHeaders["contentType"];
    if (theHeaders) {
      for (let key in theHeaders) {
        xhr.setRequestHeader(key, theHeaders[key]);
      }
    }
    // xhr.setRequestHeader("Authorization", "Basic " + btoa("username:password"))
    const that = this;
    xhr.addEventListener('readystatechange', function () {
      if (xhr.readyState < 4) {
        // 加载中
      } else if (xhr.readyState === 4 && xhr.status === 200) {
        // 成功
        handleSuccess(xhr.responseText, xhr.statusText, xhr);
      } else {
        // 失败
        handleError(xhr, xhr.statusText);
        xhr.abort();
        ret = false
      }
    })
    xhr.send(JSON.stringify(data))
  })
}
