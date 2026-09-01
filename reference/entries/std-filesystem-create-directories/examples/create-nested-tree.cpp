#include <filesystem>
#include <iostream>
#include <system_error>

namespace fs = std::filesystem;

struct Cleanup {
    fs::path root;
    ~Cleanup() {
        std::error_code ignored;
        fs::remove_all(root, ignored);
    }
};

int main() {
    const fs::path root{"batch10-create-demo"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec) return 1;
    Cleanup cleanup{root};

    const fs::path leaf = root / "a" / "b";
    const bool created = fs::create_directories(leaf, ec);
    if (ec) return 2;
    const bool directory = fs::is_directory(leaf, ec);
    if (ec) return 3;
    std::cout << std::boolalpha << "created=" << created << '\n';
    std::cout << "is_directory=" << directory << '\n';
}
