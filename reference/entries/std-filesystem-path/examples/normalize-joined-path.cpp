#include <filesystem>
#include <iostream>

int main() {
    namespace fs = std::filesystem;
    const fs::path raw = fs::path{"cache"} / "items" / ".." / "result.txt";
    std::cout << "raw=" << raw.generic_string() << '\n';
    std::cout << "normalized=" << raw.lexically_normal().generic_string()
              << '\n';
}
