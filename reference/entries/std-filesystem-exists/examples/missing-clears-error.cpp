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
    const fs::path root{"batch10-exists-missing"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec) return 1;
    Cleanup cleanup{root};

    ec = std::make_error_code(std::errc::permission_denied);
    const bool found = fs::exists(root / "item.txt", ec);
    std::cout << std::boolalpha << "exists=" << found << '\n';
    std::cout << "ec_cleared=" << !ec << '\n';
}
