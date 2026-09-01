#include <filesystem>
#include <iostream>
#include <system_error>

namespace fs = std::filesystem;

struct Cleanup {
    fs::path root;
    ~Cleanup() noexcept {
        try {
            std::error_code ignored;
            fs::remove_all(root, ignored);
        } catch (...) {
        }
    }
};

int fail(int code) {
    std::cerr << "filesystem example failed\n";
    return code;
}

int main() {
    const fs::path root{"batch10-create-repeat"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec) return fail(1);
    Cleanup cleanup{root};

    const fs::path leaf = root / "a" / "b";
    const bool first = fs::create_directories(leaf, ec);
    if (ec) return fail(2);
    ec = std::make_error_code(std::errc::permission_denied);
    const bool second = fs::create_directories(leaf, ec);
    if (ec) return fail(3);
    std::cout << std::boolalpha << "first=" << first << '\n';
    std::cout << "second=" << second << '\n';
    std::cout << "ec_cleared=" << !ec << '\n';
}
