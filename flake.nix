{
  description = "Development shell for working on the sources of benediktritter.de";

  inputs = {
    nixpkgs.url = "github:nixos/nixpkgs/nixos-24.11";
    flake-utils.url = "github:numtide/flake-utils";
  };

  outputs = { nixpkgs, flake-utils, ... }: flake-utils.lib.eachDefaultSystem (system: let
     pkgs = import nixpkgs {inherit system;};
  in {
    devShells.default = pkgs.mkShell {
      buildInputs = with pkgs; [
        nodejs_23
      ];
    };
  });
}
