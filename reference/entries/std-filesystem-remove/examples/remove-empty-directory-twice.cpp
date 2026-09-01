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
    const fs::path root{"batch10-remove-empty"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec || !fs::create_directories(root / "leaf", ec) || ec) return 1;
    Cleanup cleanup{root};

    const bool first = fs::remove(root / "leaf", ec);
    if (ec) return 2;
    ec = std::make_error_code(std::errc::permission_denied);
    const bool second = fs::remove(root / "leaf", ec);
    if (ec) return 3;
    std::cout << std::boolalpha << "first=" << first << '\n';
    std::cout << "second=" << second << '\n';
    std::cout << "ec_cleared=" << !ec << '\n';
}
