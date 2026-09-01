#include <filesystem>
#include <fstream>
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
    const fs::path root{"batch10-remove-demo"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec) return fail(1);
    Cleanup cleanup{root};
    if (!fs::create_directories(root, ec) || ec) return fail(2);

    const fs::path file = root / "item.txt";
    std::ofstream output{file};
    if (!output) return fail(3);
    output << "x";
    output.close();
    if (!output) return fail(4);

    const bool removed = fs::remove(file, ec);
    if (ec) return fail(5);
    const bool found = fs::exists(file, ec);
    if (ec) return fail(6);
    std::cout << std::boolalpha << "removed=" << removed << '\n';
    std::cout << "exists=" << found << '\n';
}
