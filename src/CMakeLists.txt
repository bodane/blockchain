# if(POLICY CMP0043)
#   cmake_policy(SET CMP0043 OLD)
# endif()

#####  Precompiled Headers  ######
# define USE_PCH to YES for using precomiled headers
# Windows: using custom-made shared PCH -- this is unusual case for MSVC... so mystery, such hack, many wow. See also: https://stackoverflow.com/questions/645747/sharing-precompiled-headers-between-projects-in-visual-studio/4170902#4170902
# Linux: using CMake-enabled shared PCH (which appeared in CMake 3.16)
MACRO(INIT_SHARED_PCH)
  IF(USE_PCH)
    MESSAGE( STATUS " ...... enabling precompiled headers, making new library: pch" )
    add_library(pch ${PCH})
    set(PCH_LIB_NAME pch)
    IF(MSVC)
      set_property(SOURCE "pch/stdafx.cpp" APPEND_STRING PROPERTY COMPILE_FLAGS " /Fo$(OutDir) /Z7 /Fd$(OutDir)vc$(PlatformToolsetVersion).pdb /Ycstdafx.h /Fp$(TargetDir)pch.pch")
    ELSEIF(APPLE OR CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
      cmake_minimum_required(VERSION 3.16)
      target_precompile_headers(pch PUBLIC "${CMAKE_CURRENT_SOURCE_DIR}/pch/stdafx.h")
    ENDIF()
  ENDIF(USE_PCH)
ENDMACRO(INIT_SHARED_PCH)

MACRO(ENABLE_SHARED_PCH target sources_var)
  IF(USE_PCH)
    IF(MSVC)
      MESSAGE( STATUS " ...... enabling precompiled headers for: " ${sources_var} )
      SET(precompiled_binary "$(TargetDir)pch.pch")
      SET(precompiled_header "${CMAKE_CURRENT_SOURCE_DIR}/pch/stdafx.h")
      SET(sources ${${sources_var}})
      foreach(src ${sources})
        if(NOT ${src} MATCHES "\\.rc$") # skip *.rc files
          SET_SOURCE_FILES_PROPERTIES(${src}
                                  PROPERTIES COMPILE_FLAGS "/Z7 /Fd$(OutDir)vc$(PlatformToolsetVersion).pdb /Yu\"${precompiled_header}\" /FI\"${precompiled_header}\" /Fp\"${precompiled_binary}\""
                                             OBJECT_DEPENDS "${precompiled_binary}")
        endif()
      endforeach()
    ELSEIF(APPLE OR CMAKE_CXX_COMPILER_ID STREQUAL "GNU")
      MESSAGE( STATUS " ...... enabling precompiled headers for: " ${target} )
      target_precompile_headers(${target} REUSE_FROM pch)
    ENDIF()
  ENDIF(USE_PCH)
ENDMACRO(ENABLE_SHARED_PCH)

MACRO(ENABLE_SHARED_PCH_EXECUTABLE target)
  IF(USE_PCH)
    IF(MSVC)
      SET_TARGET_PROPERTIES(${target} PROPERTIES LINK_FLAGS "$(OutDir)stdafx.obj")
    ENDIF()
  ENDIF(USE_PCH)
ENDMACRO(ENABLE_SHARED_PCH_EXECUTABLE)
#####  End of Precompiled Headers macros  ######




file(GLOB_RECURSE PCH pch/*)
file(GLOB_RECURSE COMMON common/*)
file(GLOB_RECURSE CRYPTO crypto/*)
file(GLOB_RECURSE CURRENCY_CORE currency_core/*)
file(GLOB_RECURSE CURRENCY_PROTOCOL currency_protocol/*)
file(GLOB_RECURSE DAEMON daemon/*)

file(GLOB_RECURSE P2P p2p/*)
file(GLOB_RECURSE RPC rpc/*)
file(GLOB_RECURSE STRATUM stratum/*)
file(GLOB_RECURSE SIMPLEWALLET simplewallet/*)
file(GLOB_RECURSE CONN_TOOL connectivity_tool/*)
file(GLOB_RECURSE WALLET wallet/*)
file(GLOB_RECURSE MINER miner/*)

if(BUILD_GUI)
  if(MSVC)
    file(GLOB_RECURSE QTDAEMON gui/qt-daemon/*.cpp gui/qt-daemon/*.h gui/qt-daemon/app.rc)
  elseif(APPLE)
    file(GLOB_RECURSE QTDAEMON gui/qt-daemon/*.cpp gui/qt-daemon/*.h gui/qt-daemon/*.mm)
  else()
    file(GLOB_RECURSE QTDAEMON gui/qt-daemon/*.cpp gui/qt-daemon/*.h)    
  endif()
  list(FILTER QTDAEMON EXCLUDE REGEX "node_modules")
endif()
# if(BUILD_GUI)
#  if(APPLE)
#    file(GLOB_RECURSE QTSERVER gui/*.cpp gui/*.h gui/*.mm)
#  else()
#    file(GLOB_RECURSE QTSERVER gui/*.cpp gui/*.h)
#  endif()
#endif()

source_group(pch FILES ${PCH})
source_group(common FILES ${COMMON})
source_group(crypto FILES ${CRYPTO})
source_group(currency_core FILES ${CURRENCY_CORE})
source_group(currency_protocol FILES ${CURRENCY_PROTOCOL})
source_group(daemon FILES ${DAEMON})
source_group(p2p FILES ${P2P})
source_group(rpc FILES ${RPC})
source_group(stratum FILES ${STRATUM})
source_group(lethean-cli-wallet FILES ${SIMPLEWALLET})
source_group(connectivity-tool FILES ${CONN_TOOL})
source_group(wallet FILES ${WALLET})

if(BUILD_GUI)
  source_group(qtserver FILES ${QTSERVER})
endif()


INIT_SHARED_PCH()

add_library(common ${COMMON})
add_dependencies(common version ${PCH_LIB_NAME})
ENABLE_SHARED_PCH(common COMMON)

if(NOT MSVC AND NOT APPLE AND NOT CLANG)  # TODO(unassigned): do we really need the clang equivalent?
   target_compile_options(common PRIVATE -fno-var-tracking-assignments)
endif()

# disable specific warning in order not to touch original code by D. J. Bernstein
if(MSVC)
  set_source_files_properties("crypto/chacha8_stream.c" PROPERTIES COMPILE_FLAGS "/wd4018")
else()
  set_source_files_properties("crypto/chacha8_stream.c" PROPERTIES COMPILE_FLAGS "-Wno-sign-compare -Wno-strict-prototypes")
endif()

add_library(crypto ${CRYPTO})

add_library(currency_core ${CURRENCY_CORE})
add_dependencies(currency_core version  ${PCH_LIB_NAME})
ENABLE_SHARED_PCH(currency_core CURRENCY_CORE)

add_library(wallet  ${WALLET})
if(CMAKE_SYSTEM_NAME STREQUAL "Android" )
  add_dependencies(wallet version ${PCH_LIB_NAME})
  target_link_libraries(wallet currency_core crypto common zlibstatic ${CMAKE_THREAD_LIBS_INIT} ${Boost_LIBRARIES} android log OpenSSL::SSL OpenSSL::Crypto)
else()
  add_dependencies(wallet version ${PCH_LIB_NAME})
  ENABLE_SHARED_PCH(wallet WALLET)
endif()

if(NOT DISABLE_TOR)
  target_link_libraries(wallet tor-connect)
endif()






if(CMAKE_SYSTEM_NAME STREQUAL "iOS")
  install(TARGETS wallet currency_core crypto common DESTINATION lib)
  message("Generating install for iOS")
  return()
elseif(CMAKE_SYSTEM_NAME STREQUAL "Android")
  install(TARGETS wallet currency_core crypto common zlibstatic DESTINATION "${CMAKE_ANDROID_ARCH_ABI}/lib")
  message("Generating install for Android")
  return()
endif()

add_library(rpc ${RPC})
add_dependencies(rpc version ${PCH_LIB_NAME})
ENABLE_SHARED_PCH(rpc RPC)

add_library(stratum ${STRATUM})
add_dependencies(stratum version ${PCH_LIB_NAME})
ENABLE_SHARED_PCH(stratum STRATUM)


target_link_libraries(currency_core lmdb mdbx)

add_executable(daemon ${DAEMON} ${P2P} ${CURRENCY_PROTOCOL})
add_dependencies(daemon version)
target_link_libraries(daemon rpc stratum currency_core crypto common libminiupnpc-static zlibstatic ethash ${CMAKE_THREAD_LIBS_INIT} ${Boost_LIBRARIES} OpenSSL::SSL OpenSSL::Crypto)
ENABLE_SHARED_PCH(daemon DAEMON)
ENABLE_SHARED_PCH_EXECUTABLE(daemon)

add_executable(connectivity_tool ${CONN_TOOL})
add_dependencies(connectivity_tool version)
target_link_libraries(connectivity_tool currency_core crypto common zlibstatic ethash ${CMAKE_THREAD_LIBS_INIT} ${Boost_LIBRARIES} OpenSSL::SSL OpenSSL::Crypto)
ENABLE_SHARED_PCH(connectivity_tool CONN_TOOL)
ENABLE_SHARED_PCH_EXECUTABLE(connectivity_tool)

add_executable(lethean-cli-wallet ${SIMPLEWALLET})
add_dependencies(lethean-cli-wallet version)
target_link_libraries(lethean-cli-wallet wallet rpc currency_core crypto common zlibstatic ethash ${CMAKE_THREAD_LIBS_INIT} ${Boost_LIBRARIES} OpenSSL::SSL OpenSSL::Crypto)

ENABLE_SHARED_PCH(lethean-cli-wallet SIMPLEWALLET)
ENABLE_SHARED_PCH_EXECUTABLE(lethean-cli-wallet)

set_property(TARGET common crypto currency_core rpc stratum wallet PROPERTY FOLDER "libs")
set_property(TARGET daemon lethean-cli-wallet connectivity_tool PROPERTY FOLDER "prog")
set_property(TARGET daemon PROPERTY OUTPUT_NAME "letheand")


if(BUILD_GUI)

  if(APPLE)
    FIND_LIBRARY(COCOA_LIBRARY Cocoa)
  endif()

  set(AUTORCC ON)
  set(CMAKE_AUTOMOC ON)
  set(CMAKE_INCLUDE_CURRENT_DIR ON)
#  SET(MACOSX_BUNDLE_ICON_FILE app.icns)
  qt5_add_resources (RCC_SOURCES gui/resources/files.qrc)
  add_executable(Lethean WIN32 MACOSX_BUNDLE ${QTSERVER} ${RCC_SOURCES} )
  ENABLE_SHARED_PCH(Lethean QTSERVER)
  ENABLE_SHARED_PCH_EXECUTABLE(Lethean)
  set_property(TARGET Lethean PROPERTY OUTPUT_NAME "lethean-gui-server")

  QT5_USE_MODULES(Lethean WebEngineWidgets WebChannel WebSockets)
  find_package(Qt5PrintSupport REQUIRED)

  target_link_libraries(Lethean wallet rpc currency_core crypto common zlibstatic ethash Qt5::WebSockets Qt5::WebEngineWidgets Qt5::PrintSupport ${CMAKE_THREAD_LIBS_INIT} ${Boost_LIBRARIES} OpenSSL::SSL OpenSSL::Crypto)
  if (UNIX AND NOT APPLE)
	target_link_libraries(Lethean rt)
  endif()

  if(APPLE)
    target_link_libraries(Lethean ${COCOA_LIBRARY})
    set_property(TARGET Lethean PROPERTY XCODE_ATTRIBUTE_ENABLE_HARDENED_RUNTIME YES)
  endif()
  if(MSVC)
    target_link_libraries(Lethean shlwapi.lib)
  endif()

  set_property(TARGET Lethean PROPERTY FOLDER "prog")

  set(CMAKE_AUTOMOC OFF)

endif()
