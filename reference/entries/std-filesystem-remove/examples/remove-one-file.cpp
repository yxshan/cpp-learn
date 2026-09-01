#include <filesystem>
#include <fstream>
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
    const fs::path root{"batch10-remove-demo"};
    std::error_code ec;
    fs::remove_all(root, ec);
    if (ec || !fs::create_directories(root, ec) || ec) return 1;
    Cleanup cleanup{root};

    const fs::path file = root / "item.txt";
    std::ofstream output{file};
    if (!output) return 2;
    output << "x";
    output.close();
    if (!output) return 3;

    const bool removed = fs::remove(file, ec);
    if (ec) return 4;
    const bool found = fs::exists(file, ec);
    if (ec) return 5;
    std::cout << std::boolalpha << "removed=" << removed << '\n';
    std::cout << "exists=" << found << '\n';
}
