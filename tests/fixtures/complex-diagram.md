```d2 title="Computer System" alt="Diagram of a computer system" width=800 height=600
...@vars

direction: down

vars: {
  d2-config: {
    theme-id: 301
    pad: 20
    center: true
    layout-engine: dagre
  }
}

**: {
  style: {
    bold: false
  }
}

input: {
  label: Input
}

container: {
  label: ""
  style.shadow: true

  *: {
    width: 800
  }

  ram: {
    label: Memory
    label.near: top-center
    grid-rows: 1
    grid-gap: 0

    style: {
      double-border: true
      fill-pattern: lines
    }
    **: {
      label: ''
      width: 100
      style: {
        fill-pattern: lines
        double-border: true
      }
    }

    0
    0.style: {
      double-border: true
    }
    1
    2
    3
    4
    5
    6
    7
  }

  cpu: {
    label: Central Processing Unit (CPU)
  }

  mass-storage: {
    label: Mass Storage
  }

  ram -> cpu
  ram <- cpu

  cpu -> mass-storage
  cpu <- mass-storage
}

output: {
  label: Output
}

input -> container: {
  style.animated: true
}
container -> output: {
  style.animated: true
}
```
