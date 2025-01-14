---
title: "Understanding NixOS Modules and Declaring Options"
description: "In this blog post, we’ll explore the NixOS module system and how to declare options within it, a key skill for writing custom modules or contributing to NixOS."
pubDate: "2025-01-09"
image: "nixos-modules.png"
---

NixOS is a unique Linux distribution that uses a declarative approach to system configuration.
Instead of scattered and imperatively modified files, NixOS organizes everything into a unified, reproducible specification written in the Nix language.
At the heart of this system is the NixOS module system, a framework for defining and customizing system behavior.
Modules declaratively describe services, hardware, and preferences through options, making system configuration consistent and composable.

While using pre-defined modules is straightforward, defining your own modules with custom option types can be challenging.
In this blog post, we’ll explore the NixOS module system and how to declare options within it, a key skill for writing custom modules or contributing to NixOS.

## General Module Structure

Before diving into specific examples, let’s look at the general structure that almost all NixOS modules follow.
This template provides a foundation for defining options, defaults, and behavior in a consistent way.
Once we understand the template, we can analyze a code example and break down its key components.

```nix
{
  config,
  lib,
  pkgs,
  ...
}: let
  cfg = config.my.modules.demo;
in {
  options.my.modules.demo = {
    enable = lib.mkEnableOption "demo";
    # more options...
  };

  config = lib.mkIf cfg.enable {
    # configuration that gets applied if the module is enabled
  };
}
```

A NixOS module is a function that takes as a parameter an attribute set containing:

* `config`: The current system configuration.
* `lib`: A reference to the nixpkgs library.
* `pkgs`: A reference to the nixpkgs for the current system.

Most modules define a binding for their configuration namespace to a variable called cfg, which will later be useful.
Next, the configuration namespace is defined using the options attribute of the module.
Most modules define an enable option using the `lib.mkEnableOption` helper function.
This function provides defaults for the more general `lib.mkOption` function that we will look at later.
The result of this is a boolean option with a descriptive explanation, defaulting to false.
Finally, the configuration of the module is applied if the enable option is true.

:::note
While we've used `my.module.demo` as the namespace for our module here, it's perfectly valid to add new options to existing modules.
For we could have defined `options.services.nginx.custom` as a new sub-option for the nginx module.
Depending on the use case it might make sense to enable our custom module when `config.services.nginx.enable` is `true` instead of having our own enable option.
:::

## Declaring Simple Options with Basic Types

In this section, we will explore how to declare simple options using basic types without involving submodules.
These options form the building blocks of a NixOS module and allow you to define configuration parameters such as strings, integers, and booleans.

Below is an example of a module that defines multiple options of different types within the `options.my.modules.demo` namespace.

```nix
options.my.modules.demo = {
  enable = lib.mkEnableOption "Enable or disable the demo module.";

  message = lib.mkOption {
    type = lib.types.str;
    default = "Hello, world!";
    description = "A message to display.";
  };

  port = lib.mkOption {
    type = lib.types.int;
    default = 8080;
    description = "The port number for the demo service.";
  };

  package = lib.mkPackageOption pkgs "python3" { };
};
```

In this example, we define several options:

* `enable`: A boolean option using mkEnableOption to toggle the module on or off.
* `message`: A string option with a default value of "Hello, world!".
* `port`: An integer option specifying the port for the service, defaulting to 8080.
* `package`: A package option, defaulting to the python3 package, allowing users to customize the package used by the module.

The module system provides several helper functions, such as mkPackageOption, which simplify the process of defining options.
Additionally, `lib.types` offers all the standard types you might expect for configuration.
For more details, refer to the [NixOS Manual on Option Types](https://nixos.org/manual/nixos/stable/#sec-option-types).

Note that options can also be nested.
For example the port option could also be written as:

```nix
options.my.modules.demo = {
  server = {
    port = lib.mkOption {
      type = lib.types.int;
      default = 8080;
      description = "The port number for the demo service.";
    };
  };
};
```

This makes sense if you want to group several options that belong together.

## Applying Configuration in the Config Block

Now that we’ve defined options, the next step is to use these options in the config block of the module.
This is where the actual behavior of the module is implemented.
To make the example more realistic, let’s create a NixOS module that writes a simple one-file Python server and starts it as a systemd unit.
The `message` and `port` options will be written to a Python file, and the `package` option is used to define the python package for starting the server.

Here’s the code for the config block:

```nix
config = lib.mkIf cfg.enable {
  systemd.services.demo-server = let
    server = pkgs.writeText "demo-server.py" ''
        from http.server import BaseHTTPRequestHandler, HTTPServer

        class RequestHandler(BaseHTTPRequestHandler):
            def do_GET(self):
                response = "${cfg.message}"
                
                # Send response status code
                self.send_response(200)
                
                # Send headers
                self.send_header("Content-type", "text/plain")
                self.end_headers()
                
                # Send the response body
                self.wfile.write(response.encode())

        def run(server_class=HTTPServer, handler_class=RequestHandler, port=${toString cfg.port}):
            server_address = ("", port)
            httpd = server_class(server_address, handler_class)
            print(f"Starting server on port {port}...")
            httpd.serve_forever()

        if __name__ == '__main__':
            run()
      '';
  in {
    description = "Demo Python server";
    wantedBy = [ "multi-user.target" ];
    serviceConfig = {
      ExecStart = "${lib.getExe cfg.package} ${server}";
      Restart = "always";
    };
  };
};
```

In this example we're using a builder function called `writeText` that writes a text file to the Nix store and returns a reference to it.
It takes as arguments the name of the file to write and the contents of the file.
nixpkgs offers several [useful builder functions](https://nixos.org/manual/nixpkgs/stable/#trivial-builder-writeText) like this.
The file is later used to define a [systemd service](https://search.nixos.org/options?channel=unstable&from=0&size=50&sort=relevance&type=packages&query=systemd.services.%3Cname%3E) that takes care of starting the server.
After applying this configuration to your system, `systemctl status demo-service` should report that the demo service is running.
When pointing your browser to http://localhost:8080 you should see the message that you have configured.

:::tip
If you want to write more sophisticated Python programs that may require additional dependencies, have a look at the [`writePython3Bin` function](https://github.com/NixOS/nixpkgs/blob/515a7562c8e11176638d4c4920948afefdf27207/pkgs/build-support/writers/scripts.nix#L1236-L1257).
:::

## Next level: Complex Option Types

So far we've defined a NixOS module that starts a web server that always responds with the same configurable greeting.
But what if we wanted to have a configurable list of greetings instead?
One way of doing this would be to define an option called greetings that has a type of `lib.types.listOf (lib.types.attrsOf lib.types.str)`.
When configuring the module, users could write the following:

```nix
my.modules.demo = {
  enable = true;
  greetings = [
    {
      path = "jane";
      message = "Hi Joe!";
    }
    {
      path = "joe";
      message = "Howdy Joe!";
    }
  ];
}
```

In the config block of our module we could map over the greetings and write conditions to the python file.
Unfortunately due to Python being indentation sensitive the code gets a little bit messy:

```nix
server = pkgs.writeText "demo-server.py" (''
  from http.server import BaseHTTPRequestHandler, HTTPServer

  class RequestHandler(BaseHTTPRequestHandler):
      def do_GET(self):
          response = "${cfg.message}"
  ''
  + (lib.concatLines (lib.map (g: "        if self.path == '/${g.name}':\n            response = '${g.message}'\n") cfg.greetings))
  + ''
          # Send response status code
          self.send_response(200)

          # Send headers
          self.send_header("Content-type", "text/plain")
          self.end_headers()

          # Send the response body
          self.wfile.write(response.encode())

  def run(server_class=HTTPServer, handler_class=RequestHandler, port=${toString cfg.port}):
      server_address = ("", port)
      httpd = server_class(server_address, handler_class)
      print(f"Starting server on port {port}...")
      httpd.serve_forever()

  if __name__ == '__main__':
      run()
'');
```

In order to create the conditional code that will match the configured greetings to their path, we need to map over the list of greetings.
`lib.map` is a function that takes two arguments, a function to apply to elements of a list, and the list to map over.
The mapping function in this case needs to take into account the indentation level in the target file.
That's why the line is so wide.
Furthermore the `map` step is wrapped into `lib.concatLines` which takes a list of strings and concatinates them into a string separated by line breaks.

For the two greetings that we configured for Jane and joe, the resulting Python code will look like this:

```python
        response = "Hello, world!"
        if self.path == 'jane':
            response = 'Hi, Jane!'

        if self.path == 'joe':
            response = 'Howdy, Joe!'
```

After activating the new configuration on your system, when pointing the browser to http://localhost:8080/jane we will be greeted with "Hi, Jane!", and when navigating to http://localhost:8080/joe you will see the greeting "Howdy, Joe!".

## Boss Level: Using Submodules to define Option types

Using lists of attribute sets is a great way of defining complex option types.
However, there's one problem with our current solution.
There's nothing stopping a user from defining an abitrary atrribute set that doesn't have the right key-value pairs.
This makes it harder for users to understand how they can configure the module.
What we need is a way of defining the shape of the attribute sets that can be put into the `greetings` list.
Luckily, the NixOS module system has us covered with the `lib.types.submodule` function.
The function does exactly what the name indicates, it lets you define a new module (including `options`, and `config`) and use it as the type of an option.
Here's how that looks like in action:

```nix
greetings = lib.mkOption {
  description = "The list of greetings.";
  type = lib.types.listOf (lib.types.submodule ({ config, ... }: {
    options = {
      name = lib.mkOption {
        description = "The name of the person to greet.";
        type = lib.types.str;
      };
      message = lib.mkOption {
        description = "The gretting for that person, default to `Hello, <name>`";
        type = lib.types.str;
        default = "Hello, ${config.name}";
      };
    };
  }));
};
```

This again looks more scary than it is.
The key part here is that we've replaced `lib.types.attrsOf lib.types.str` as the component type of the greetings list with our own submodule.
`lib.types.submodule` is a function that comes in two flavors.
You can either directly pass an attribute set defining `options`, and `config`.
Or - if you need to self-reference the module like we do in the default for the message option - `submodule` takes a module defintion function.
As with top level module function, this function provides access to `config`, but in this case it's not the system config, but the config of the submodule.

:::tip
It's also possible to define a config block inside the submodule.
This makes it possible apply configuration specific to the submodule, like writing submodule specific files to the nix store.
:::

With this option definition in place for `greetings`, users immediately get the following error if they define have a typo in their configuration:

```
error: The option `my.modules.demo.greetings."[definition 1-entry 1]".messgae' does not exist. Definition values:
- In `/nix/store/bfs9klmi3md673k294myk8fn9vywyrqg-source/configuration.nix': "Hi, Jane!"
```

## Conclusion

In this blog post, we’ve explored the powerful NixOS module system, starting from its structure and diving into how to declare and use options.
We’ve learned how to define simple options with basic types, nest options for better organization, how to define custom option types using submodules, and how to apply configurations in the config block.

The NixOS module system provides a robust framework for managing system configurations declaratively.
However, while the system is powerful, the documentation can be sparse and hard to find.
With practice and exploration, you can unlock its full potential to create flexible, reusable, and composable configurations.
I hope this blog post was a help in that regard.

If you need help with NixOS or want to optimize your setup, I offer [NixOS consulting services](/services/nixos).
Feel free to get in touch with me!

