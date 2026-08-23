#include <iostream>

int main() {
#if defined(__has_feature)
#if __has_feature(address_sanitizer)
    int* value = new int(7);
    delete value;
    std::cout << *value << '\n';
#else
    std::cout << "ok\n";
#endif
#else
    std::cout << "ok\n";
#endif
    return 0;
}
