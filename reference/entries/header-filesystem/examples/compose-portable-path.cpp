#include <filesystem>
#include <iostream>

int main() {
    namespace fs = std::filesystem;
    const fs::path path = fs::path{"assets"} / "icons" / "logo.svg";
    std::cout << "path=" << path.generic_string() << '\n';
}
