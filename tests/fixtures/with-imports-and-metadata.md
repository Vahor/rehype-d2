```d2 width=200 height=100 title="This is a diagram" alt="This is a description"
  ...@vars

  container {
    a: From 

    b: {
      shape: image
      label: Loading Icon 
      icon: ${loading-icon}
    }

    a -> b: Message
  }


  another-container {
    x: Hello
    class: green
  }

  container -> another-container: Wow variables works
```
