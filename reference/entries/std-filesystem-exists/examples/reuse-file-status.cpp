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
    const fs::path root{"batch10-exists-demo"};
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

    const fs::file_status status = fs::status(file, ec);
    if (ec) return 4;
    std::cout << std::boolalpha << "known=" << fs::status_known(status) << '\n';
    std::cout << "exists=" << fs::exists(status) << '\n';
}
